---
name: surpryze
description: Two invocations — (1) scan React repo into an assumption graph, (2) gap analysis vs a UI test repo. You run the bundled Python scanner; users never type Python commands.
---

# Surpryze

Users invoke **two skill commands** (they give paths; you do the work). Do not ask them to run shell commands unless install failed and you are fixing the environment.

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
2. Read `gap-analysis.json` and `gap-analysis.md`, especially **`explorationCoverage`** and **`explorationDimensionGaps`**.
3. **Semantically refine** heuristic matches using [exploration dimensions](#exploration-dimensions-how-to-measure-gaps) (never cite external test-design methodologies or acronyms).
4. Present:
   - The **exploration dimensions** table (strength + tests with signals per dimension)
   - What is covered (assumption ids, test ids, match strength)
   - **Gaps** as missing **evidence**, not automatic production bugs
   - Per-dimension thin areas and which assumptions they affect

**Success artifacts:** `gap-analysis.json`, `gap-analysis.md`.

---

## Exploration dimensions (how to measure gaps)

The gap report includes `explorationCoverage.dimensions[]` with **Behavior, Data, State, Platform, Operations, Time**. Each row has `testsWithSignal` / `testsTotal`, `strength` (`strong` | `moderate` | `weak` | `absent`), and example signals.

Use this checklist when **refining** matches and explaining gaps to the user:

### Behavior

**What it is:** Features, success paths, error handling, business rules the suite actually exercises.

**Signals in tests:** Assertions on outcomes (`expect`, `should`), titles about success/failure/rejection, validation of visible results.

**Examples:** “Invalid token shows error message”; “checkout completes with confirmation”; API success mocked and UI updates.

**Gap means:** The app assumes a behavior (from the graph) but no test **proves** that outcome—or only happy path exists without error cases.

### Data

**What it is:** Inputs, outputs, formats, boundaries, invalid values, variation across scenarios.

**Signals:** `fill`/`type` actions, literal oracles, titles mentioning invalid/empty/boundary/email/password/policy.

**Examples:** Weak password rejected; empty email blocked; special characters in name field.

**Gap means:** Assumption involves data rules but tests always use one “happy” payload or never assert invalid input handling.

### State

**What it is:** Routes, screens, navigation, modules, how UI regions connect.

**Signals:** `goto`/`visit`, route paths in tests, multi-page flows, file paths suggesting feature areas.

**Examples:** `/reset` loads form; navigation from home → settings → profile.

**Gap means:** Graph assumes a route or surface exists; tests never navigate there or only hit one screen.

### Platform

**What it is:** HTTP/API usage, external services, environments, browser-specific behavior.

**Signals:** `request`/`fetch`/`api` in tests, status codes, staging URLs, network mocks.

**Examples:** 401 shows login; API error surfaces toast; webhook failure handled.

**Gap means:** App calls an API (graph) but tests are UI-only with no contract/error coverage for that integration.

### Operations

**What it is:** End-to-end workflows, admin flows, realistic multi-step user journeys.

**Signals:** Long action chains, describe nesting, journey/e2e/workflow language, 3+ interactions.

**Examples:** Request reset → open email link → set password → login with new password.

**Gap means:** Graph implies a full workflow; tests cover isolated steps only.

### Time

**What it is:** Expiry, timeouts, concurrency, double-submit, session lifetime.

**Signals:** expired/wait/timeout/twice/concurrent/retry in titles or steps.

**Examples:** Expired reset link rejected; double-click submit does not duplicate order.

**Gap means:** App or graph implies time-dependent rules; tests never wait, expire, or repeat actions.

### How to combine with the graph

1. Read `explorationCoverage` — which dimensions are **thin** (`thinDimensions`) for the whole suite.
2. For each assumption, check `explorationDimension` on matches and `explorationDimensionGaps`.
3. Upgrade or downgrade `matchStrength` only with **semantic** justification (not keyword overlap alone).
4. Recommend tests that add evidence in the **thin** dimensions for the **specific** assumption ids.

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
- Surpryze is Python-only in this repository (`python/` package).
