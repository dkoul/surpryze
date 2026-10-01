# Surpryze

**Assumption Graph from your React app, matched to UI tests—with a Claude/Cursor skill.**

| Step | Who | What |
|------|-----|------|
| 1 | CLI | `scan-app` — programmatic React scan → assumption graph |
| 2 | **Claude/Cursor skill** | Semantic match Playwright / Cypress / Selenium tests to the graph |
| 3 | CLI | `match finalize` — evidence, confidence, `agent-context.md` |

## Install

```bash
npm install github:dkoul/surpryze --save-dev
```

Copy **`skills/surpryze/`** into your Claude/Cursor skills directory.

```bash
npx surpryze init --app-root .                    # React repo
npx surpryze init --tests-root ../ui-test-repo    # optional separate test repo
npx surpryze scan-app
npx surpryze match prepare --tests-root ../ui-test-repo
# → run skill → write .surpryze/coverage-matches.json
npx surpryze match finalize
```

## Artifacts

| File | Step |
|------|------|
| `graph.json` | After `scan-app` (and updated after `match finalize`) |
| `coverage-match/AGENT-PROMPT.md` | After `match prepare` |
| `coverage-matches.json` | **Agent required** |
| `agent-context.md` | After `match finalize` |

UI tests can live in the application repo or another team's repo—point `--tests-root` at the test codebase.

Skill: [`skills/surpryze/SKILL.md`](skills/surpryze/SKILL.md)
