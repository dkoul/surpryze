# Surpryze

**Assumption Graphs describe what teams believe software does.**

Surpryze builds an **Assumption Graph** from an existing **Playwright** test repository—without requiring application source code. Semantic analysis (LLM when configured) plus structural parsing produces assumptions, evidence links, confidence, and gaps. Coding agents use the output to **increase evidence**, not to receive a blind “write more tests” mandate.

```bash
npx surpryze init
npx surpryze analyze    # full pipeline (primary)
npx surpryze graph      # review in terminal
npx surpryze context    # .surpryze/agent-context.md for Cursor / Claude Code
```

### Agent-first artifacts (`.surpryze/`)

| File | Purpose |
|------|---------|
| `graph.json` | Machine-readable Assumption Graph |
| `report.html` | Human-readable analysis |
| `agent-context.md` | Compact uncertainty-focused context for coding agents |
| `confidence-runs.json` | History for confidence deltas across runs |

Set `OPENAI_API_KEY` or `SURPRYZE_LLM_API_KEY` for OpenAI semantic analysis; otherwise a local heuristic semantic pass runs (no API).

`surpryze learn` is an alias for `surpryze analyze`.

Product definition: [`docs/PRD.md`](docs/PRD.md).

---

## Playwright repo at the project root

```bash
cd my-app
npm install github:dkoul/surpryze --save-dev
npx surpryze init
npx surpryze analyze
```

Add `.surpryze/` to `.gitignore`.

### Focused agent context

```bash
npx surpryze context --assumption A-abc12345
npx surpryze context --weakest 10
```

### After agents add tests

Re-run `surpryze analyze` and check confidence changes in the CLI output or `agent-context.md`.

---

## Optional (not MVP-critical)

- `surpryze explore` — bounded experiments when the app is running  
- `skills/surpryze-gap-analyst/` — optional gap-analyst skill on top of `graph.json`

See [`docs/AGENT-WORKFLOW.md`](docs/AGENT-WORKFLOW.md) for agent integration notes.
