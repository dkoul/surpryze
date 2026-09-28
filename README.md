# Surpryze

**Turn surprise into knowledge.**

Surpryze is a **layer on top of Playwright**—your tests and runner stay the same. It answers:

1. **What assumptions are you making in tests?** (titles, actions, `expect()` oracles)  
2. **Where should you write more tests?** (untested beliefs, weak oracles, contradictions, missing assertions)

```bash
npx surpryze learn          # 1 — build graph (deterministic)
npx surpryze graph          # 2 — review assumptions + heuristic gaps + SFDOT
npx surpryze graph --json   # 2 — full graph for agents
# 3 — gap analyst skill (see skills/surpryze-gap-analyst/SKILL.md)
```

Artifacts: `.surpryze/assumption-graph.json`, `.surpryze/agent-handoff.json`, `.surpryze/testing-gaps.json`

**Agents:** read `docs/AGENT-WORKFLOW.md`. After `graph --json`, run the **surpryze-gap-analyst** skill to suggest data variation, flows, and tests—grounded in graph IDs, not as production proof.

---

## You already have Playwright at the repo root

If your project looks like this, you are in the right place:

```text
my-app/
├── playwright.config.ts    # or .js / .mjs
├── package.json
├── tests/                  # or e2e/, specs at root, etc.
│   └── *.spec.ts
└── …
```

### What to do now

**1. Install Surpryze in that repo** (as a dev dependency):

```bash
cd my-app
npm install github:dkoul/surpryze --save-dev
```

The package builds on install (`prepare` runs `tsc`). You need Node **18+**.

**2. Ignore Surpryze artifacts** (add to `.gitignore` if not already there):

```gitignore
.surpryze/
```

**3. From the same directory** (`my-app`, where `playwright.config.*` lives), run:

```bash
npx surpryze init
npx surpryze learn
npx surpryze graph
```

You do **not** need `--root` when your shell is already at the project root. Every command defaults to the current directory (`.`).

**4. Use the output**

| Artifact | Path |
|----------|------|
| Assumptions + where to test (agents) | `.surpryze/testing-gaps.json` or `gaps --json` |
| Full assumption graph | `.surpryze/assumption-graph.json` or `graph --json` |
| Human summary | `npx surpryze gaps` |
| Knowledge DB | `.surpryze/knowledge.db` |

**5. Re-run after you change tests**

```bash
npx surpryze learn
npx surpryze graph
```

**6. Optional — exploration** (only when your app is running and reachable):

```bash
npx surpryze explore --budget 10 --base-url http://localhost:3000
npx surpryze report
npx surpryze status
```

Use the same `baseURL` you use in Playwright (or pass `--base-url`).

### Optional npm scripts in `my-app`

```json
{
  "scripts": {
    "beliefs": "surpryze learn && surpryze gaps",
    "beliefs:json": "surpryze gaps --json"
  }
}
```

Then: `npm run beliefs`

---

## What each command does (from your repo root)

| Command | When |
|---------|------|
| `npx surpryze init` | Once per repo — detects Playwright, creates `.surpryze/` |
| `npx surpryze learn` | After test changes — graph + gap analysis |
| `npx surpryze gaps` | **Assumptions you make** + **where to add tests** |
| `npx surpryze gaps --json` | Machine-readable recommendations for agents |
| `npx surpryze graph` | Full assumption graph (weakest claims first) |
| `npx surpryze graph --json` | Full graph JSON |
| `npx surpryze explore --budget <n>` | Run bounded experiments (app must be up) |
| `npx surpryze investigate SURPRISE-…` | Inspect and classify a surprise |
| `npx surpryze report` | HTML + JSON summary under `.surpryze/` |
| `npx surpryze status` | Quick counts and epistemic coverage |

To point at another directory: add `--root /path/to/project` (only needed when you are **not** cd’d into the Playwright project).

---

## Working on the Surpryze tool itself

Clone this repository, then:

```bash
npm install
npx playwright install chromium
npm run build
npm run surpryze -- <command> [options]
```

---

## Try the built-in demo

Demo app + sample suite live under `examples/`. From **this** repo:

```bash
npm run demo:app   # terminal 1 — http://127.0.0.1:3456
```

```bash
npm run build
export ROOT=examples/password-reset-suite
npm run surpryze -- init  --root "$ROOT"
npm run surpryze -- learn --root "$ROOT"
npm run surpryze -- graph --root "$ROOT"
```

Optional full loop (app running): `npm run demo:full`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Surpryze not initialized` | Run `npx surpryze init` from the Playwright project root |
| `learn` reports 0 tests | Run commands from the directory that contains `playwright.config.*`; check that `*.spec.ts` / `*.test.ts` exist |
| `surpryze: command not found` | Use `npx surpryze` or add a `scripts` entry in `package.json` |
| Install from GitHub fails to build | Use Node 18+; run `cd node_modules/surpryze && npm run build` once |
| `explore` does nothing useful | Start your app; set `--base-url` to match Playwright `baseURL` |

---

## How it fits together

```text
Your Playwright tests (unchanged)
        ↓ learn
Assumption Graph  →  graph / graph --json
        ↓ explore (optional)
Experiments → surprises → investigate → report
```

Surpryze does **not** replace Playwright or rewrite your tests. Exploration is **bounded** (`--budget`). Humans decide what surprises mean.

---

## License

MIT
