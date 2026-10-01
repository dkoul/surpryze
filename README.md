# Surpryze

Surpryze helps you see **what your team believes your software does**—and **how well your UI tests support those beliefs**.

It is an **epistemic layer** on top of your normal workflow: you keep React and your test stack (Playwright, Cypress, or Selenium). Surpryze does not replace them.

---

## Purpose

Most teams ship **code** and **tests**, but the link between them is fuzzy. Surpryze:

1. **Reads your React app** and builds an **Assumption Graph**—explicit claims about routes, APIs, forms, and UI behavior implied by the code.
2. **Compares your UI tests** to that graph and shows **gaps**: assumptions with little or no test evidence.

Use the output to decide where to add or strengthen tests—not as a automatic “bug list.”

---

## The science behind the epistemic layer

**Code graphs** describe what is *in* the repository (files, symbols, dependencies).

**Assumption graphs** describe what the team *treats as true* about behavior: “this route exists,” “this API is called,” “this flow is possible.” Those beliefs usually live in heads, tickets, and tests—not in one model.

Surpryze makes those beliefs **visible** and scores them by **evidence**:

| Idea | Meaning |
|------|--------|
| **Assumption** | A claim about application behavior (with an id and provenance from code or tests). |
| **Evidence** | Tests (or code signals) that support or fail to support a claim. |
| **Confidence** | How strong the evidence is—not a guess about production correctness. |
| **Gap** | An important assumption with weak or missing test evidence. |
| **Unknown** | A valid result: “we don’t know yet,” not “the app is broken.” |

Low confidence means **uncertainty**, not “defect.” The goal is to **reduce uncertainty** with the right tests—not to maximize test count.

---

## Installation

Surpryze runs as a **Claude or Cursor skill** (the agent runs the Python scanner in this repo).

1. Clone or copy this repository.
2. Install the skill in your editor:
   - **Cursor:** copy `skills/surpryze/` to `.cursor/skills/surpryze/` in your project (or your user skills folder).
   - **Claude Code:** add the same folder to your project’s skills location per Claude’s docs.

The skill bundle includes a small **Python toolkit**; your agent uses it automatically when you invoke Surpryze.

---

## Use

Talk to your agent in two steps. You only need **paths** to your repos.

### Step 1 — Assumption graph from React

Ask for a **scan-react** (or describe the same intent):

> Scan my React app at `/path/to/my-app` and build the assumption graph.

You get `assumption-graph.json` and a plain-language summary of what the app assumes.

### Step 2 — Gap analysis vs UI tests

Point at your **test repo** (same monorepo or another team’s repo) and the graph from step 1:

> Run gap analysis: UI tests in `/path/to/e2e`, assumption graph at `/path/to/assumption-graph.json`.

You get `gap-analysis.json` and `gap-analysis.md`: what is covered, what is thin, exploration dimension coverage (behavior, data, state, platform, operations, time), and where more test evidence would help.

### Tips

- Re-run **step 1** after meaningful React changes.
- Re-run **step 2** after test changes or a new graph.
- Playwright, Cypress, and Selenium test folders are detected automatically.

---

## Examples in this repo

- React sample app: `examples/react-password-ui`
- UI test sample: `examples/password-reset-suite`

---

## Toolkit (for agents)

Python CLI lives in [`python/`](python/). Optional local install: `make install` or `cd python && pip install -e .`

Try the examples: `make demo-scan` then `make demo-gap`.

## More detail

[`skills/surpryze/SKILL.md`](skills/surpryze/SKILL.md)
