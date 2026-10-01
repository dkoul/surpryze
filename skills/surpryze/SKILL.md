---
name: surpryze
description: Claude/Cursor skill — build an Assumption Graph from a React app, then semantically match Playwright/Cypress/Selenium coverage. LLM steps are required.
---

# Surpryze

Surpryze is a **Claude / Cursor skill** with a small CLI engine.

1. **React (programmatic)** — `scan-app` builds the application assumption graph from source.
2. **UI tests (agent)** — semantic coverage match against that graph using internal coverage lenses (structure, behavior, data, interaction, platform, operations, time). Do not cite external methodology names.

Install: copy this folder to your Claude/Cursor skills directory. In the repo: `npm install surpryze --save-dev` and `npx surpryze init`.

---

## Step 1 — Application graph (CLI)

From the Surpryze project root (often the React monorepo root):

```bash
npx surpryze init --app-root .          # or --tests-root ../e2e-repo
npx surpryze scan-app
```

Outputs `.surpryze/graph.json` with assumptions from React (routes, API usage, forms, components). Review `report.html` if helpful.

Optional: enrich assumptions in conversation (still cite code provenance)—then re-run `scan-app` after code changes.

---

## Step 2 — UI test coverage (you, the agent)

UI tests may live in the **same repo** or a **separate** Playwright/Cypress/Selenium repo.

```bash
npx surpryze match prepare --tests-root /path/to/ui-tests   # omit if co-located
```

Read:

- `.surpryze/coverage-match/AGENT-PROMPT.md`
- `.surpryze/coverage-match/app-assumptions.json`
- `.surpryze/coverage-match/ui-tests-digest.json`

**You must** write `.surpryze/coverage-matches.json` (schema in the prompt). Semantically map each assumption `A-…` to test ids (`T-…`, `UT-…`). Use the coverage lens checklist in the prompt internally.

```bash
npx surpryze match finalize
```

Then read `.surpryze/agent-context.md` and explain to the user:

- What the app assumes
- What UI tests actually cover (and how strongly)
- Where evidence is thin—**without** calling gaps automatic bugs

---

## Re-run

After React or test changes: `scan-app` → `match prepare` → update matches → `match finalize`.

---

## Legacy commands

`prepare` / `finalize` / `analyze` on **tests-only** graphs remain for older flows; the product default is **React first**, then UI match.
