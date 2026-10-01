"""Exploration dimension coverage over UI tests (and assumption mapping)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from surpryze.ui_tests import UiTestCase

# Public dimension ids (user-facing labels in reports)
DIMENSION_ORDER = (
    "behavior",
    "data",
    "state",
    "platform",
    "operations",
    "time",
)

DIMENSION_META: dict[str, dict[str, str]] = {
    "behavior": {
        "label": "Behavior",
        "description": (
            "What the application does: features, success and error paths, business rules "
            "implied by tests"
        ),
    },
    "data": {
        "label": "Data",
        "description": (
            "Inputs, outputs, formats, boundary values, invalid data, and variation across scenarios"
        ),
    },
    "state": {
        "label": "State",
        "description": (
            "Structure of the product under test: routes, UI regions, modules, and how pieces connect"
        ),
    },
    "platform": {
        "label": "Platform",
        "description": (
            "Browsers, APIs, environments, and external dependencies the suite touches"
        ),
    },
    "operations": {
        "label": "Operations",
        "description": (
            "End-to-end workflows, admin flows, and how users operate the product"
        ),
    },
    "time": {
        "label": "Time",
        "description": (
            "Timeouts, expiry, concurrency, scheduling, and time-dependent behavior"
        ),
    },
}

# Heuristic patterns (test title + excerpt)
_PATTERNS: dict[str, re.Pattern[str]] = {
    "behavior": re.compile(
        r"should|can|must|reset|login|checkout|submit|create|delete|update|validate|"
        r"error|success|fail|handle|reject|policy|visible|contain|expect",
        re.I,
    ),
    "data": re.compile(
        r"invalid|boundary|empty|null|max|min|length|unicode|email|password|payload|"
        r"json|weak|strong|variant|format|special|char",
        re.I,
    ),
    "state": re.compile(
        r"route|page|screen|nav|goto|visit|module|component|layout|region|path|home|dashboard",
        re.I,
    ),
    "platform": re.compile(
        r"browser|chrome|firefox|webkit|mobile|api|http|request|fetch|oauth|env|"
        r"staging|webhook|external|status\s*\d",
        re.I,
    ),
    "operations": re.compile(
        r"workflow|flow|journey|e2e|end.to.end|admin|onboard|step|scenario|complete|full",
        re.I,
    ),
    "time": re.compile(
        r"expir|timeout|wait|delay|concurrent|parallel|race|schedule|ttl|session|"
        r"later|again|twice|retry",
        re.I,
    ),
}


def _test_text(t: UiTestCase) -> str:
    return f"{t.title} {t.file_path} {' '.join(t.routes)} {t.excerpt}"


def score_test_dimensions(test: UiTestCase) -> dict[str, list[str]]:
    text = _test_text(test)
    out: dict[str, list[str]] = {d: [] for d in DIMENSION_ORDER}

    for dim, pat in _PATTERNS.items():
        if pat.search(text):
            out[dim].append(f"keyword/signal in {test.title[:60]}")

    if test.routes:
        out["state"].append(f"routes: {', '.join(test.routes[:3])}")
    if test.api_hints:
        out["platform"].append(f"api: {', '.join(test.api_hints[:3])}")
    if "fill" in test.excerpt.lower() or "type" in test.excerpt.lower():
        out["data"].append("input/fill actions")
    if len(re.findall(r"(click|goto|visit|press)", test.excerpt, re.I)) >= 2:
        out["operations"].append("multi-step actions in excerpt")
    if "expect" in test.excerpt.lower() or "should" in test.excerpt.lower():
        out["behavior"].append("assertions / expectations")

    return out


def build_exploration_coverage(tests: list[UiTestCase]) -> dict[str, Any]:
    total = len(tests)
    dim_tests: dict[str, set[str]] = {d: set() for d in DIMENSION_ORDER}
    dim_signals: dict[str, list[str]] = {d: [] for d in DIMENSION_ORDER}

    for t in tests:
        scores = score_test_dimensions(t)
        for dim in DIMENSION_ORDER:
            if scores[dim]:
                dim_tests[dim].add(t.id)
                for sig in scores[dim][:2]:
                    if sig not in dim_signals[dim]:
                        dim_signals[dim].append(sig)

    dimensions: list[dict[str, Any]] = []
    thin: list[str] = []

    for dim in DIMENSION_ORDER:
        with_signal = len(dim_tests[dim])
        meta = DIMENSION_META[dim]
        if total == 0:
            strength = "absent"
        elif with_signal == 0:
            strength = "absent"
        elif with_signal >= max(2, total * 0.4):
            strength = "strong"
        elif with_signal >= 1:
            strength = "moderate" if with_signal >= total * 0.15 else "weak"
        else:
            strength = "weak"

        if strength in ("absent", "weak"):
            thin.append(dim)

        dimensions.append(
            {
                "dimension": dim,
                "label": meta["label"],
                "description": meta["description"],
                "testsWithSignal": with_signal,
                "testsTotal": total,
                "strength": strength,
                "signals": dim_signals[dim][:8],
                "exampleTestIds": list(dim_tests[dim])[:5],
            }
        )

    return {
        "dimensions": dimensions,
        "thinDimensions": thin,
    }


def map_assumption_lens_to_dimension(lens: str) -> str:
    """Map internal coverageLens from graph to exploration dimension id."""
    mapping = {
        "function": "behavior",
        "structure": "state",
        "interaction": "behavior",
        "data": "data",
        "platform": "platform",
        "operations": "operations",
        "time": "time",
        "behavior": "behavior",
        "state": "state",
    }
    return mapping.get(lens, "behavior")


def dimension_gaps_for_assumptions(
    matches: list[dict],
    exploration: dict[str, Any],
) -> list[dict]:
    """Gaps where assumption primary dimension is thin in the suite or match is weak."""
    thin = set(exploration.get("thinDimensions", []))
    dim_by_id = {d["dimension"]: d for d in exploration.get("dimensions", [])}
    out: list[dict] = []

    for m in matches:
        dim = map_assumption_lens_to_dimension(m.get("coverageLens", "function"))
        suite_strength = dim_by_id.get(dim, {}).get("strength", "absent")
        with_sig = dim_by_id.get(dim, {}).get("testsWithSignal", 0)
        total = dim_by_id.get(dim, {}).get("testsTotal", 0)
        match_strength = m.get("matchStrength")

        if dim not in thin and match_strength in ("strong", "moderate"):
            continue

        meta = DIMENSION_META[dim]
        out.append(
            {
                "assumptionId": m["assumptionId"],
                "statement": m.get("statement", "")[:200],
                "explorationDimension": dim,
                "dimensionLabel": meta["label"],
                "assumptionMatchStrength": match_strength,
                "suiteDimensionStrength": suite_strength,
                "reason": (
                    f"{meta['label']}: {with_sig}/{total} tests show signals for this dimension "
                    f"(suite strength: {suite_strength}); assumption match: {match_strength}."
                ),
            }
        )
    return out
