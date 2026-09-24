# Surpryze

**Turn surprise into knowledge.**

Surpryze is an epistemic testing layer for Playwright. It learns from your existing suite, models assumptions, runs bounded experiments, and treats **surprises** (observations that conflict with your knowledge model) as first-class signals.

## Quick start (demo)

```bash
npm install
npx playwright install chromium
npm run build

# Terminal 1 — demo app
npm run demo:app

# Terminal 2 — epistemic loop
node dist/cli/index.js init --root examples/password-reset-suite
node dist/cli/index.js learn --root examples/password-reset-suite
node dist/cli/index.js explore --root examples/password-reset-suite --budget 5
node dist/cli/index.js report --root examples/password-reset-suite
node dist/cli/index.js status --root examples/password-reset-suite
```

## CLI

| Command | Description |
|---------|-------------|
| `surpryze init` | Detect Playwright project, create `.surpryze/` |
| `surpryze learn` | Parse tests, extract assumptions (heuristic LLM provider in MVP) |
| `surpryze explore --budget 20` | Plan & run experiments via Playwright |
| `surpryze investigate SURPRISE-xxx` | Show evidence; optional `--classify` / `--decision` |
| `surpryze report` | Write `report.html` and `report.json` |
| `surpryze status` | Summary metrics |

## Architecture

- **Parser** — TypeScript ESTree mining of Playwright tests
- **Knowledge store** — SQLite (`better-sqlite3`) with provenance
- **Experiments** — Generated Playwright specs under `.surpryze/experiments/`
- **Surprise detector** — Deterministic rules first (MVP)
- **Reporting** — HTML + JSON epistemic metrics

## MVP principles

- Does not replace Playwright or your regression suite
- Bounded, reproducible exploration with experiment budgets
- Humans classify surprises; AI does not silently become the oracle

## License

MIT
