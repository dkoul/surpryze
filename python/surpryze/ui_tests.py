from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path


@dataclass
class UiTestCase:
    id: str
    framework: str
    file_path: str
    title: str
    excerpt: str
    routes: list[str]
    api_hints: list[str]
    tokens: set[str]


def _tid(file_path: str, title: str) -> str:
    return "UT-" + hashlib.sha256(f"{file_path}|{title}".encode()).hexdigest()[:8]


def _tokenize(text: str) -> set[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9_-]{2,}", text.lower())
    return {w for w in words if w not in {"test", "expect", "async", "await", "const", "the", "and"}}


def _collect_files(root: Path) -> list[tuple[str, Path]]:
    glob_patterns = [
        ("playwright", "**/*.spec.ts"),
        ("playwright", "**/*.spec.js"),
        ("playwright", "**/*.spec.mjs"),
        ("playwright", "**/*.test.ts"),
        ("playwright", "**/*.test.js"),
        ("cypress", "**/*.cy.ts"),
        ("cypress", "**/*.cy.js"),
        ("cypress", "cypress/e2e/**/*.ts"),
        ("cypress", "cypress/e2e/**/*.js"),
    ]
    found: list[tuple[str, Path]] = []
    skip = {"node_modules", ".git", "dist"}
    for framework, pat in glob_patterns:
        for p in root.glob(pat):
            if not p.is_file():
                continue
            if any(s in p.parts for s in skip):
                continue
            found.append((framework, p))

    for p in root.rglob("*"):
        if not p.is_file() or p.suffix not in (".ts", ".js", ".java"):
            continue
        if any(s in p.parts for s in skip):
            continue
        try:
            body = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if re.search(r"selenium-webdriver|webdriver\.io|org\.openqa\.selenium", body, re.I):
            if "playwright" not in body.lower():
                found.append(("selenium", p))

    # dedupe
    seen: set[Path] = set()
    out: list[tuple[str, Path]] = []
    for fw, p in found:
        if p in seen:
            continue
        seen.add(p)
        out.append((fw, p))
    return sorted(out, key=lambda x: str(x[1]))


def _parse_playwright_cypress(path: Path, framework: str, root: Path) -> list[UiTestCase]:
    text = path.read_text(encoding="utf-8", errors="replace")
    rel = str(path.relative_to(root))
    cases: list[UiTestCase] = []

    for m in re.finditer(
        r"(?:test|it)\s*\(\s*['\"`]([^'\"`]+)['\"`]",
        text,
    ):
        title = m.group(1)
        start = m.start()
        excerpt = text[start : start + 1200]
        routes = re.findall(r"goto\s*\(\s*['\"]([^'\"]+)['\"]", excerpt)
        routes += re.findall(r"visit\s*\(\s*['\"]([^'\"]+)['\"]", excerpt)
        apis = re.findall(r"/api/[a-zA-Z0-9_/-]+", excerpt)
        tokens = _tokenize(title + " " + excerpt)
        cases.append(
            UiTestCase(
                _tid(rel, title),
                framework,
                rel,
                title,
                excerpt[:500],
                routes,
                apis,
                tokens,
            )
        )

    if not cases:
        tokens = _tokenize(text[:2000])
        cases.append(
            UiTestCase(
                _tid(rel, path.name),
                framework,
                rel,
                path.name,
                text[:500],
                re.findall(r"['\"](/[^'\"]+)['\"]", text[:2000]),
                re.findall(r"/api/[a-zA-Z0-9_/-]+", text),
                tokens,
            )
        )
    return cases


def digest_ui_tests(test_root: Path) -> tuple[str, list[UiTestCase]]:
    test_root = test_root.resolve()
    files = _collect_files(test_root)
    if not files:
        raise SystemExit(f"No UI test files found under {test_root}")

    framework = files[0][0]
    frameworks = {f[0] for f in files}
    if len(frameworks) == 1:
        framework = frameworks.pop()
    else:
        framework = "mixed"

    cases: list[UiTestCase] = []
    for fw, p in files:
        if fw in ("playwright", "cypress"):
            cases.extend(_parse_playwright_cypress(p, fw, test_root))
        else:
            cases.extend(_parse_playwright_cypress(p, "selenium", test_root))

    return framework, cases
