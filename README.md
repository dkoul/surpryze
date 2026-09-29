# Surpryze

**Assumption Graphs describe what teams believe software does.**

Surpryze is a **Cursor / Claude Code skill** plus a small CLI engine. Playwright tests are parsed structurally; **the host agent (you) performs required semantic analysis**; the CLI merges proposals into an Assumption Graph with evidence-derived confidence and agent-ready artifacts.

## Install the skill

Copy into your skills directory:

```text
.cursor/skills/surpryze/     ← from this repo: skills/surpryze/
```

Install the CLI in the Playwright repo:

```bash
npm install github:dkoul/surpryze --save-dev
npx surpryze init
```

## Workflow (LLM required)

```bash
npx surpryze prepare          # 1 — digest + AGENT-PROMPT.md
# 2 — run the Surpryze skill in Cursor/Claude; agent writes .surpryze/semantic-proposals.json
npx surpryze finalize         # 3 — graph.json, report.html, agent-context.md
```

`npx surpryze analyze` runs **finalize** when proposals exist; otherwise it runs **prepare** and exits with instructions to complete the skill.

There is **no** heuristic-only analysis path. For CI, commit a proposals file or use `finalize --semantic-file path.json`. Optional `finalize --use-api` calls OpenAI when `OPENAI_API_KEY` is set (automation only, not the primary product).

## Artifacts (`.surpryze/`)

| File | Role |
|------|------|
| `semantic-proposals.json` | **Required** agent output (semantic layer) |
| `graph.json` | Assumption Graph |
| `report.html` | Human report |
| `agent-context.md` | Uncertainty context for coding agents |

Product definition: [`docs/PRD.md`](docs/PRD.md) · Skill: [`skills/surpryze/SKILL.md`](skills/surpryze/SKILL.md)

## After tests change

`prepare` → update proposals in the skill → `finalize` → check confidence deltas in CLI or `agent-context.md`.
