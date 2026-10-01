from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from surpryze.exploration_dimensions import (
    DIMENSION_META,
    build_exploration_coverage,
    dimension_gaps_for_assumptions,
    map_assumption_lens_to_dimension,
)
from surpryze.lenses import LENS_LABELS
from surpryze.ui_tests import UiTestCase, digest_ui_tests


def _assumption_tokens(statement: str, provenance: list[dict]) -> set[str]:
    text = statement + " " + " ".join(
        str(p.get("label", "")) + str(p.get("id", "")) for p in provenance
    )
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9_-]{2,}", text.lower())
    return set(words)


def _score_match(assumption: dict, test: UiTestCase) -> tuple[float, str]:
    a = assumption.get("assumption", assumption)
    statement = a.get("statement", "")
    prov = a.get("provenance", [])
    atoks = _assumption_tokens(statement, prov)

    score = 0.0
    reasons: list[str] = []

    overlap = atoks & test.tokens
    if overlap:
        score += min(0.4, len(overlap) * 0.08)
        reasons.append(f"shared terms: {', '.join(sorted(overlap)[:6])}")

    stmt_lower = statement.lower()
    for r in test.routes:
        if r.strip("/") and r.strip("/") in stmt_lower:
            score += 0.35
            reasons.append(f"route {r}")
    for api in test.api_hints:
        if api in statement or api.split("/")[-1] in stmt_lower:
            score += 0.35
            reasons.append(f"api hint {api}")

    if test.title.lower() in stmt_lower or any(t in test.title.lower() for t in overlap):
        score += 0.15

    title_words = set(re.findall(r"[a-z]{4,}", test.title.lower()))
    feat = (a.get("feature") or "").lower()
    if feat and feat in title_words:
        score += 0.2
        reasons.append(f"feature {feat}")

    return min(1.0, score), "; ".join(reasons) or "weak lexical overlap"


def _strength(score: float) -> str:
    if score >= 0.55:
        return "strong"
    if score >= 0.32:
        return "moderate"
    if score >= 0.12:
        return "weak"
    return "none"


def run_gap_analysis(test_root: Path, graph_path: Path) -> dict[str, Any]:
    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    assumptions_raw = graph.get("assumptions", [])
    if not assumptions_raw:
        raise SystemExit("Graph has no assumptions")

    framework, tests = digest_ui_tests(test_root)
    now = datetime.now(timezone.utc).isoformat()

    matches: list[dict] = []
    gaps: list[dict] = []
    covered = 0

    for entry in assumptions_raw:
        a = entry.get("assumption", entry)
        aid = a["id"]
        lens = entry.get("coverageLens", "function")
        exploration_dim = map_assumption_lens_to_dimension(lens)
        best: list[tuple[float, UiTestCase, str]] = []

        for t in tests:
            sc, why = _score_match(entry, t)
            if sc > 0.08:
                best.append((sc, t, why))
        best.sort(key=lambda x: -x[0])
        top = best[:5]

        test_ids = [t[1].id for t in top if _strength(t[0]) != "none"]
        top_score = top[0][0] if top else 0.0
        strength = _strength(top_score)

        match = {
            "assumptionId": aid,
            "statement": a.get("statement", ""),
            "coverageLens": lens,
            "coverageLensLabel": LENS_LABELS.get(lens, lens),
            "explorationDimension": exploration_dim,
            "explorationDimensionLabel": DIMENSION_META[exploration_dim]["label"],
            "matchStrength": strength,
            "testIds": test_ids,
            "matchedTests": [
                {
                    "id": t[1].id,
                    "title": t[1].title,
                    "file": t[1].file_path,
                    "score": round(t[0], 3),
                    "rationale": t[2],
                }
                for t in top[:3]
            ],
            "gapNote": None,
        }

        if strength in ("none", "weak"):
            note = (
                "No strong UI test semantically covers this application assumption. "
                "Review agent skill lenses for missing behavior, data, or workflow evidence."
            )
            match["gapNote"] = note
            gaps.append(
                {
                    "assumptionId": aid,
                    "statement": a.get("statement", ""),
                    "priority": "high" if strength == "none" else "medium",
                    "coverageLens": lens,
                    "explorationDimension": exploration_dim,
                    "explorationDimensionLabel": DIMENSION_META[exploration_dim]["label"],
                    "reason": note,
                    "suggestedFocus": _suggest_focus(lens),
                }
            )
        else:
            covered += 1

        matches.append(match)

    uncovered_ids = [g["assumptionId"] for g in gaps if g["priority"] == "high"]

    exploration_coverage = build_exploration_coverage(tests)
    exploration_dimension_gaps = dimension_gaps_for_assumptions(matches, exploration_coverage)

    return {
        "version": 1,
        "generatedAt": now,
        "uiTestFramework": framework,
        "uiTestsRoot": str(test_root.resolve()),
        "assumptionGraphPath": str(graph_path.resolve()),
        "summary": {
            "assumptions": len(assumptions_raw),
            "uiTests": len(tests),
            "withModerateOrStrongMatch": covered,
            "gaps": len(gaps),
            "uncoveredHighPriority": len(uncovered_ids),
        },
        "matches": matches,
        "gaps": gaps,
        "uncoveredAssumptionIds": uncovered_ids,
        "explorationCoverage": exploration_coverage,
        "explorationDimensionGaps": exploration_dimension_gaps,
        "agentBrief": {
            "instruction": (
                "Refine matches semantically using exploration dimensions (behavior, data, state, "
                "platform, operations, time). Use explorationCoverage.testsWithSignal per dimension. "
                "Heuristic scores are a starting point only. Gaps are missing evidence, not defects."
            ),
            "testsDigest": [
                {
                    "id": t.id,
                    "title": t.title,
                    "file": t.file_path,
                    "framework": t.framework,
                }
                for t in tests
            ],
        },
    }


def _suggest_focus(lens: str) -> str:
    dim = map_assumption_lens_to_dimension(lens)
    hints = {
        "behavior": "Add tests for success, error, and business rules (clear oracles).",
        "state": "Add tests that navigate routes and assert key UI regions/modules.",
        "data": "Add tests for validation, boundaries, invalid inputs, and data variation.",
        "platform": "Add tests for API contracts, HTTP errors, or environment-specific deps.",
        "operations": "Add multi-step workflow tests across the full user journey.",
        "time": "Add tests for expiry, timeouts, double-submit, or concurrency.",
    }
    return hints.get(dim, "Add targeted UI tests linked to this assumption.")


def write_gap_markdown(report: dict, path: Path) -> None:
    lines = [
        "# Surpryze gap analysis",
        "",
        f"Graph: `{report['assumptionGraphPath']}`",
        f"UI tests: `{report['uiTestsRoot']}` ({report['uiTestFramework']})",
        "",
        "## Summary",
        "",
        f"- Assumptions: **{report['summary']['assumptions']}**",
        f"- UI test cases: **{report['summary']['uiTests']}**",
        f"- Moderate/strong matches: **{report['summary']['withModerateOrStrongMatch']}**",
        f"- Gaps flagged: **{report['summary']['gaps']}**",
        "",
        "## Exploration dimensions (UI test suite)",
        "",
        "| Dimension | Strength | Tests | Description |",
        "|-----------|----------|-------|-------------|",
    ]
    for d in report.get("explorationCoverage", {}).get("dimensions", []):
        desc = d["description"].replace("|", "/")[:80]
        lines.append(
            f"| {d['label']} | {d['strength']} | {d['testsWithSignal']}/{d['testsTotal']} | {desc} |"
        )
    thin = report.get("explorationCoverage", {}).get("thinDimensions", [])
    if thin:
        lines.append("")
        lines.append(f"**Thin dimensions:** {', '.join(thin)}")
    lines.extend(["", "## Gaps (prioritized)", ""])
    for g in report.get("gaps", [])[:30]:
        lines.append(f"### `{g['assumptionId']}` ({g['priority']}) — {g.get('coverageLens', '')}")
        lines.append(g["statement"])
        lines.append("")
        lines.append(f"- {g['reason']}")
        lines.append(f"- Suggested focus: {g['suggestedFocus']}")
        lines.append("")

    lines.append("## Per-assumption matches")
    lines.append("")
    for m in report.get("matches", []):
        lines.append(f"- **{m['assumptionId']}** ({m['matchStrength']}): {m['statement'][:100]}…")
        if m.get("matchedTests"):
            for t in m["matchedTests"]:
                lines.append(f"  - `{t['id']}` {t['title']} (score {t['score']})")
        elif m.get("gapNote"):
            lines.append(f"  - _{m['gapNote']}_")
        lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")
