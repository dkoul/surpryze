from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path


@dataclass
class CodeSignal:
    id: str
    file_path: str
    kind: str
    label: str
    line: int | None = None


@dataclass
class Assumption:
    id: str
    statement: str
    feature: str | None
    source: str
    coverage_lens: str
    provenance: list[dict]
    confidence: float
    evidence_class: str


def _aid(statement: str) -> str:
    h = hashlib.sha256(statement.strip().lower().encode()).hexdigest()[:8]
    return f"A-{h}"


def _sid(file_path: str, kind: str, label: str) -> str:
    raw = f"{file_path}|{kind}|{label}"
    return "RS-" + hashlib.sha256(raw.encode()).hexdigest()[:8]


def _react_files(root: Path) -> list[Path]:
    files: list[Path] = []
    skip = {"node_modules", "dist", "build", ".git", ".surpryze"}
    for ext in ("*.tsx", "*.jsx", "*.ts", "*.js"):
        for p in root.rglob(ext):
            if any(part in skip for part in p.parts):
                continue
            if re.search(r"\.(test|spec)\.(tsx|jsx|ts|js)$", p.name):
                continue
            files.append(p)
    return sorted(files)


def scan_file(path: Path, root: Path) -> list[CodeSignal]:
    text = path.read_text(encoding="utf-8", errors="replace")
    rel = str(path.relative_to(root))
    signals: list[CodeSignal] = []

    for m in re.finditer(r"path:\s*['\"]([^'\"]+)['\"]", text):
        label = m.group(1)
        signals.append(
            CodeSignal(_sid(rel, "route", label), rel, "route", f"Route {label}", None)
        )
    for m in re.finditer(r"(?:to|href)=\{?['\"]([^'\"]+)['\"]", text):
        label = m.group(1)
        signals.append(
            CodeSignal(_sid(rel, "route", label), rel, "route", f"Link {label}", None)
        )
    for m in re.finditer(r"fetch\s*\(\s*['\"]([^'\"]+)['\"]", text):
        url = m.group(1)
        signals.append(CodeSignal(_sid(rel, "api", url), rel, "api", url, None))
    if re.search(r"<form\b", text, re.I):
        signals.append(CodeSignal(_sid(rel, "form", "form"), rel, "form", "<form>", None))

    name = path.stem
    if name not in ("index", "main"):
        signals.append(
            CodeSignal(_sid(rel, "component", name), rel, "component", name, None)
        )
    return signals


def build_assumptions(signals: list[CodeSignal]) -> list[Assumption]:
    from surpryze.lenses import infer_lens

    candidates: list[tuple[str, str | None, str, list[CodeSignal]]] = []

    for s in signals:
        if s.kind == "route":
            candidates.append(
                (
                    f"The application exposes route or navigation target: {s.label}",
                    "routing",
                    "structure",
                    [s],
                )
            )
        elif s.kind == "api":
            candidates.append(
                (
                    f"The application calls backend endpoint: {s.label}",
                    "api",
                    "platform",
                    [s],
                )
            )
        elif s.kind == "form":
            candidates.append(
                (
                    f"The application provides a form interaction ({s.label}) in {s.file_path}",
                    "forms",
                    "interaction",
                    [s],
                )
            )
        elif s.kind == "component":
            lens = infer_lens(s.label)
            candidates.append(
                (
                    f'The application includes UI surface "{s.label}" with behavior implied by its implementation',
                    s.label,
                    lens,
                    [s],
                )
            )

    seen: set[str] = set()
    out: list[Assumption] = []
    for statement, feature, lens, sigs in candidates:
        aid = _aid(statement)
        if aid in seen:
            continue
        seen.add(aid)
        prov = [
            {"kind": "code", "id": s.id, "label": f"{s.kind}: {s.label} ({s.file_path})"}
            for s in sigs
        ]
        out.append(
            Assumption(
                id=aid,
                statement=statement,
                feature=feature,
                source="application",
                coverage_lens=lens,
                provenance=prov,
                confidence=0.55,
                evidence_class="WEAK",
            )
        )
    return out


def scan_react_repo(react_root: Path) -> dict:
    react_root = react_root.resolve()
    if not (react_root / "package.json").exists():
        pkg_up = react_root
        if not (pkg_up / "package.json").exists():
            raise SystemExit(f"Not a React/npm project root: {react_root}")

    files = _react_files(react_root)
    if not files:
        raise SystemExit(f"No React source files found under {react_root}")

    all_signals: list[CodeSignal] = []
    for f in files:
        all_signals.extend(scan_file(f, react_root))

    assumptions = build_assumptions(all_signals)
    now = datetime.now(timezone.utc).isoformat()

    return {
        "version": 2,
        "generatedAt": now,
        "graphOrigin": "application",
        "applicationSummary": {
            "reactFilesScanned": len(files),
            "assumptionsFromCode": len(assumptions),
        },
        "projectSummary": {
            "testsAnalyzed": 0,
            "assumptions": len(assumptions),
            "edges": 0,
            "testingGaps": 0,
        },
        "assumptions": [
            {
                "assumption": {
                    "id": a.id,
                    "statement": a.statement,
                    "feature": a.feature,
                    "source": a.source,
                    "confidence": a.confidence,
                    "evidenceClass": a.evidence_class,
                    "claimPrecision": "structural",
                    "status": "UNTESTED",
                    "provenance": a.provenance,
                    "expectedLiterals": [],
                    "missingScenarios": [],
                },
                "coverageLens": a.coverage_lens,
                "supportedByTests": [],
                "missingEvidence": ["No UI test evidence linked yet"],
            }
            for a in assumptions
        ],
        "coverageDisclaimer": (
            "This graph is derived from React source structure. It does not prove runtime behavior. "
            "Gaps are not automatic defects."
        ),
    }
