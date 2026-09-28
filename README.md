# Surpryze

**Turn surprise into knowledge.**

Surpryze sits on top of your existing Playwright tests. It builds an **Assumption Graph** from what your suite already believes, then (optionally) runs bounded experiments and surfaces **surprises** when reality disagrees with that model.

---

## Requirements

- **Node.js 18+**
- An existing **Playwright** project (or use the included demo)

---

## Install

From this repository:

```bash
npm install
npx playwright install chromium
npm run build
```

Use the CLI via npm (no global install needed):

```bash
npm run surpryze -- <command> [options]
```

After `npm run build`, you can also run `node dist/cli/index.js` directly.

---

## Try the demo (5 minutes)

The demo is a small password-reset API plus a Playwright suite under `examples/`.

**1. Start the app** (leave this terminal open):

```bash
npm run demo:app
```

You should see: `Password reset demo listening on http://127.0.0.1:3456`

**2. Run Surpryze** (new terminal, from repo root):

```bash
npm run build

export ROOT=examples/password-reset-suite

npm run surpryze -- init   --root "$ROOT"
npm run surpryze -- learn  --root "$ROOT"
npm run surpryze -- graph  --root "$ROOT"
```

**What you get**

| Step | Output |
|------|--------|
| `init` | `.surpryze/` config + SQLite path |
| `learn` | **Assumption Graph** → `$ROOT/.surpryze/assumption-graph.json` |
| `graph` | Weakest assumptions first (human-readable) |
| `graph --json` | Same graph for Cursor / Codex / Claude Code |

**3. Optional — explore & report** (demo app must still be running):

```bash
npm run surpryze -- explore --root "$ROOT" --budget 5
npm run surpryze -- report  --root "$ROOT"
npm run surpryze -- status  --root "$ROOT"
```

Open `examples/password-reset-suite/.surpryze/report.html` in a browser.

One-liner for init + learn + explore + report (app running):

```bash
npm run demo:full
```

---

## Use on your Playwright repo

Point `--root` at the directory that contains your `playwright.config.*` and tests.

```bash
cd /path/to/your/playwright-project

# From the surpryze repo (after npm run build there):
node /path/to/surpryze/dist/cli/index.js init  --root .
node /path/to/surpryze/dist/cli/index.js learn --root .
node /path/to/surpryze/dist/cli/index.js graph --root .
node /path/to/surpryze/dist/cli/index.js graph --root . --json > assumption-graph.json
```

Typical workflow:

1. **`init`** — once per project  
2. **`learn`** — after test changes (refreshes the Assumption Graph)  
3. **`graph`** — inspect weak / untested beliefs  
4. **`explore`** — when you want experiments (needs your app reachable; use `--base-url`)  
5. **`investigate SURPRISE-…`** — review and classify a surprise  
6. **`report`** / **`status`** — metrics and HTML summary  

All artifacts live under **`.surpryze/`** (safe to gitignore).

---

## Commands

| Command | What it does |
|---------|----------------|
| `init --root <dir>` | Detect Playwright layout; create `.surpryze/` |
| `learn --root <dir>` | Parse tests → Assumption Graph + `assumption-graph.json` |
| `graph --root <dir>` | Print graph (weakest assumptions first) |
| `graph --root <dir> --json` | Full graph JSON for agents |
| `explore --root <dir> --budget <n>` | Generate & run experiments via Playwright |
| `explore --base-url <url>` | Override app URL (default demo: `http://127.0.0.1:3456`) |
| `investigate <id> --root <dir>` | Evidence brief for a surprise |
| `investigate <id> --classify potential_defect --decision ACCEPTED_DEFECT` | Record human decision |
| `report --root <dir>` | Write `.surpryze/report.html` and `report.json` |
| `status --root <dir>` | Short summary (counts, epistemic coverage) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Surpryze not initialized` | Run `init --root` first |
| `learn` finds 0 tests | Check `--root` points at the Playwright project; ensure `playwright.config.*` and `*.spec.ts` exist |
| `explore` fails / no observations | App must be up; set `--base-url` to match your `baseURL` |
| Command not found | Run `npm run build` and use `npm run surpryze --` or `node dist/cli/index.js` |

---

## How it fits together

```
Your Playwright tests
        ↓ learn
Assumption Graph (JSON + SQLite)
        ↓ graph          ↓ explore (optional)
Human / agent review    Experiments → surprises → investigate → report
```

- **Parser** — mines tests and assertions  
- **Knowledge store** — SQLite with provenance (`better-sqlite3`)  
- **Experiments** — generated specs under `.surpryze/experiments/`  
- **Surprises** — deterministic rules first (MVP)  

Surpryze does **not** replace Playwright or your regression suite. Exploration is **bounded** (`--budget`). Humans classify important surprises.

---

## License

MIT
