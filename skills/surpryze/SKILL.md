---
name: surpryze
description: Two invocations — (1) scan React repo into an assumption graph, (2) gap analysis vs a UI test repo. You run the bundled Python scanner; users never type Python commands.
---

# Surpryze

Users invoke **two skill commands** (they give paths; you do the work). Do not ask them to run `pip`, `npm`, or `python` unless install failed and you are fixing the environment.

---

## Invocation 1: `surpryze scan-react`

**User intent:** Build an assumption graph from a React codebase.

**User argument (required):**

- `react_repo` — absolute or workspace path to the React application root (contains `package.json` + `src` / `app`).

**Optional:**

- `output` — where to write the graph (default: `<react_repo>/assumption-graph.json`).

**What you do:**

1. Resolve `react_repo` on disk; confirm it looks like a React project.
2. Run the toolkit scanner (see [Agent runtime](#agent-runtime) below). Write JSON to `output`.
3. Read the graph and explain in plain language:
   - What the app **assumes** (routes, APIs, forms, UI surfaces)
   - Assumption ids (`A-…`) tied to **code provenance** only—do not invent behavior.
4. Return the output file path to the user.

**Success artifact:** `assumption-graph.json` (assumption graph).

---

## Invocation 2: `surpryze gap-analysis`

**User intent:** See how well an existing UI test suite covers the assumption graph.

**User arguments (required):**

- `test_repo` — path to Playwright, Cypress, or Selenium tests (may be a **different repo** than the React app).
- `assumption_graph` — path to `assumption-graph.json` from invocation 1.

**Optional:**

- `output` — gap report JSON path (default: same directory as `assumption_graph`, file `gap-analysis.json`).

**What you do:**

1. Run the toolkit gap matcher (see [Agent runtime](#agent-runtime)).
2. Read `gap-analysis.json` and `gap-analysis.md`.
3. **Semantically refine** heuristic matches using these lenses internally (never name external methodologies or acronyms):
   - Structure, behavior, data, interaction, platform, operations, time
4. Present:
   - What is covered (which assumptions, which tests, how strong)
   - **Gaps** as missing **evidence**, not automatic production bugs
   - Concrete suggestions grounded in assumption ids

**Success artifacts:** `gap-analysis.json`, `gap-analysis.md`.

---

## Agent runtime

When executing either invocation, locate the Surpryze toolkit (this repo’s `python/` package). Prefer:

```text
<toolkit>/python  →  python3 -m surpryze scan|gap ...
```

**Invocation 1 → internal command shape:**

```text
python3 -m surpryze scan <react_repo> -o <output>
```

**Invocation 2 → internal command shape:**

```text
python3 -m surpryze gap <test_repo> <assumption_graph> -o <output>
```

If `python3 -m surpryze` fails, `cd <toolkit>/python && pip install -e .` once, then retry. Users should not need to know this.

Working directory: any; use absolute paths for all arguments.

---

## Example user phrases (map to invocations)

| User says | Invocation |
|-----------|------------|
| “Scan my React app at …” | `surpryze scan-react` |
| “Build assumption graph for …” | `surpryze scan-react` |
| “Match e2e tests to the graph …” | `surpryze gap-analysis` |
| “Gap analysis: tests in … graph at …” | `surpryze gap-analysis` |

---

## Rules

- Two steps in order when both are needed: **scan-react** → **gap-analysis**.
- Re-run scan-react after React changes; re-run gap-analysis after tests or graph change.
- No npm / Node Surpryze CLI for this skill.
