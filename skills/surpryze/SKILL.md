---
name: surpryze
description: Build an Assumption Graph from Playwright tests. You (the host LLM) perform required semantic analysis; the CLI handles parsing, evidence, confidence, and artifacts for Cursor/Claude Code.
---

# Surpryze (Cursor / Claude Code skill)

Surpryze is **not** a standalone CLI product without you. The CLI parses tests and computes evidence; **you** provide mandatory semantic understanding of what the suite believes about the application.

## Install

Copy this folder into the project or user skills path:

```text
.cursor/skills/surpryze/SKILL.md    # Cursor
# or Claude Code equivalent skills directory
```

Install the engine in the Playwright repo:

```bash
npm install github:dkoul/surpryze --save-dev
npx surpryze init
```

## Workflow (always follow)

### 1. Prepare (deterministic)

```bash
npx surpryze prepare
```

Read:

- `.surpryze/semantic-analysis/tests-digest.json`
- `.surpryze/semantic-analysis/AGENT-PROMPT.md`

### 2. Semantic analysis (you — required)

Infer assumptions the tests encode about **application behavior**, not just assertion syntax.

Write **`.surpryze/semantic-proposals.json`**:

```json
{
  "version": 1,
  "generatedBy": "cursor",
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "assumptions": [
    {
      "statement": "…",
      "feature": "optional",
      "rationale": "…",
      "derivedFromTestIds": ["T-…"],
      "applicationBehaviorKnown": false
    }
  ]
}
```

Rules:

- **No confidence scores** — Surpryze derives confidence from evidence.
- Every assumption links to `derivedFromTestIds` from the digest.
- If app source is unavailable, use `applicationBehaviorKnown: false` rather than guessing production truth.
- Absence of evidence ≠ evidence of falsehood; use `unknown` style rationale when appropriate.

Optional: user may attach OpenAPI, requirements, or app docs — cite them in `rationale` only; do not invent oracles.

### 3. Finalize (deterministic)

```bash
npx surpryze finalize
```

Produces:

| Artifact | Purpose |
|----------|---------|
| `.surpryze/graph.json` | Assumption Graph |
| `.surpryze/report.html` | Human report |
| `.surpryze/agent-context.md` | Uncertainty-focused context for **further** coding work |

### 4. Explain to the user

Summarize from `agent-context.md`:

- What the suite **believes** and why
- Weakest / unknown assumptions
- What **evidence** would increase confidence (not “bugs” by default)

## Commands reference

```bash
npx surpryze graph
npx surpryze context
npx surpryze context --weakest 10
npx surpryze context --assumption A-xxxxxxxx
```

## Re-run after test changes

`prepare` → update `semantic-proposals.json` → `finalize`. Mention confidence deltas when `confidence-runs.json` shows movement.

## What you are not doing

- Not replacing Playwright or generating tests unless the user asks
- Not treating low confidence as automatic defects
- Not skipping semantic analysis (no heuristic-only graph)
