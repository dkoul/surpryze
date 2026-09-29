# Agent workflow

## Primary flow

```bash
npx surpryze analyze
npx surpryze graph          # optional terminal review
npx surpryze context        # writes .surpryze/agent-context.md
```

Give **`agent-context.md`** (or focused `surpryze context --weakest 10`) to **Cursor** or **Claude Code**. Ask the agent to increase **evidence** for listed assumptions—not to treat every gap as a bug.

## Artifacts

| File | Use |
|------|-----|
| `graph.json` | Full graph, IDs, edges, gaps |
| `agent-context.md` | Prioritized uncertainty and testing intents |
| `report.html` | Human review |
| `agent-handoff.json` | Paths and summary after analyze |

## Rules for agents

1. Honor `coverageDisclaimer` and `fidelityNote` in the graph.  
2. Cite assumption (`A-…`), test (`T-…`), and gap (`GAP-…`) IDs.  
3. Do not fabricate expected values outside `expectedLiterals` / assertions.  
4. `UNKNOWN` is a valid outcome.

## Optional skill

`skills/surpryze-gap-analyst/SKILL.md` adds structured gap suggestions on top of `graph.json`.
