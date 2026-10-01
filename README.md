# Surpryze

**Claude/Cursor skill** + **Python CLI** (no npm required).

| Skill command | CLI | Arguments |
|---------------|-----|-----------|
| **1** | `surpryze scan` | React repo → `assumption-graph.json` |
| **2** | `surpryze gap` | Test repo + graph file → `gap-analysis.json` / `.md` |

## Python CLI

```bash
cd python
pip install -e .

surpryze scan /path/to/react-app -o assumption-graph.json
surpryze gap /path/to/ui-tests assumption-graph.json -o gap-analysis.json
```

- **Command 1:** programmatic React scan (routes, APIs, forms, components).
- **Command 2:** digest Playwright / Cypress / Selenium tests, heuristic match + gap report; the skill agent refines matches semantically.

## Skill

Install [`skills/surpryze/SKILL.md`](skills/surpryze/SKILL.md) in Claude/Cursor.

## Demo

```bash
pip install -e python
surpryze scan examples/react-password-ui -o /tmp/graph.json
surpryze gap examples/password-reset-suite /tmp/graph.json -o /tmp/gaps.json
```

## Legacy Node CLI

The `npm` / TypeScript CLI in the repo root is **legacy** and not required for the skill.
