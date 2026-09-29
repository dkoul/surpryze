# Agent workflow

Surpryze is a **Cursor / Claude Code skill**. The host LLM is **required** for semantic analysis.

## Steps

```bash
npx surpryze prepare
# Invoke skill: skills/surpryze/SKILL.md — write .surpryze/semantic-proposals.json
npx surpryze finalize
npx surpryze context
```

## Artifacts

| File | Producer |
|------|----------|
| `semantic-analysis/AGENT-PROMPT.md` | CLI (`prepare`) |
| `semantic-proposals.json` | **Host agent (skill)** |
| `graph.json`, `report.html`, `agent-context.md` | CLI (`finalize`) |

## Optional

`skills/surpryze-gap-analyst/` — extra gap suggestions after `finalize`.

`finalize --use-api` — OpenAI only for CI; not the primary product path.
