---
name: surpryze
description: Two-command Claude skill — (1) scan React repo to assumption graph JSON, (2) gap analysis vs UI test repo. Uses Python CLI only; no npm.
---

# Surpryze

Two **skill commands**. Each command runs the Python CLI, then you (the agent) interpret results for the user.

## Setup (once per machine)

From the Surpryze toolkit checkout:

```bash
cd python && pip install -e .
```

Or without install:

```bash
export SURPRYZE_PY=/path/to/surpryze/python
python3 -m surpryze --help   # run with cwd=$SURPRYZE_PY or PYTHONPATH=$SURPRYZE_PY
```

---

## Skill command 1 — React assumption graph

**Argument:** path to the **React application repository**.

```bash
surpryze scan <react_repo> -o <assumption-graph.json>
```

Example:

```bash
surpryze scan /workspace/my-react-app -o ./assumption-graph.json
```

**You must:**

1. Run the command above (fix paths for the user’s machine).
2. Read the generated JSON and summarize what the application **assumes** (routes, APIs, forms, UI surfaces).
3. Cite assumption ids (`A-…`) and code provenance from the file.

Output is **programmatic** from source; do not invent behaviors not supported by provenance.

---

## Skill command 2 — Gap analysis (UI tests vs graph)

**Arguments:** path to **UI test repository**, path to **assumption graph file** from command 1.

```bash
surpryze gap <test_repo> <assumption-graph.json> -o <gap-analysis.json>
```

Example:

```bash
surpryze gap /workspace/e2e-playwright ./assumption-graph.json -o ./gap-analysis.json
```

Also writes `gap-analysis.md` next to the JSON.

**You must:**

1. Run the command (Playwright, Cypress, or Selenium tests are auto-detected).
2. Read `gap-analysis.json` and `gap-analysis.md`.
3. **Semantically refine** the heuristic matches using internal coverage lenses:
   - Structure, behavior, data, interaction, platform, operations, time  
   (Do not name any external test-design methodology or acronym.)
4. Explain gaps as **missing evidence**, not automatic bugs.
5. For each high-priority gap, suggest what kind of test evidence would increase confidence (grounded in assumption ids).

---

## Workflow

```text
Command 1: react_repo  → assumption-graph.json
Command 2: test_repo + assumption-graph.json → gap-analysis.json + gap-analysis.md
```

Re-run command 1 after React changes; re-run command 2 after test or graph changes.

---

## What you are not doing

- Not using npm / `npx surpryze` (deprecated for this skill).
- Not replacing the user’s test framework.
- Not treating weak coverage as a production defect by default.
