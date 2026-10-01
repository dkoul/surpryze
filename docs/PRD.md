# Surpryze — React-first pivot

## Product

1. **Claude/Cursor skill** + CLI engine.
2. **Step 1 (programmatic):** Scan a **React** codebase → application **Assumption Graph**.
3. **Step 2 (agent, required):** Scan **Playwright / Cypress / Selenium** tests (same repo or separate) → **semantic coverage match** against the graph using internal coverage lenses (do not brand the heuristic).

## Commands

```bash
surpryze init [--app-root] [--tests-root]
surpryze scan-app
surpryze match prepare [--tests-root]
# agent writes coverage-matches.json
surpryze match finalize
```

## Thesis

Code graphs describe what software contains. Assumption graphs describe what teams believe software does. Surpryze makes application beliefs visible, then shows how well UI tests support those beliefs.
