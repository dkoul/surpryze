# Agent workflow: learn → graph → gap analyst

Surpryze separates **deterministic extraction** from **gap suggestion** (agent/skill).

## Steps

```bash
npx surpryze init    # once
npx surpryze learn   # step 1: parse Playwright tests → SQLite + JSON
npx surpryze graph   # step 2: human view (includes gaps + SFDOT + graph)
npx surpryze graph --json   # step 2b: full graph for tools
```

## Step 3: gap analyst skill

Use the skill at **`skills/surpryze-gap-analyst/SKILL.md`** (in the Surpryze repo).

- In **Cursor**: copy or link into `.cursor/skills/surpryze-gap-analyst/SKILL.md`, or @-mention the skill after `learn` + `graph`.
- As a **subagent**: parent task reads `.surpryze/agent-handoff.json`, attaches `assumption-graph.json`, and runs the skill instructions.

The skill must:

- Cite assumption/test/gap IDs from the graph
- Respect `coverageDisclaimer` and `fidelityNote`
- Suggest data variation, flows, and SFDOT-aligned tests—not production truth

## Artifacts

| File | When |
|------|------|
| `.surpryze/assumption-graph.json` | After `learn` |
| `.surpryze/agent-handoff.json` | After `learn` — paths, summary, skill pointer |
| `.surpryze/testing-gaps.json` | After `learn` — gaps subset |

`npx surpryze gaps` is equivalent to the gaps section of `graph` (no skill invocation). Use `npx surpryze graph --no-gaps` for the assumption graph only.

After `learn`, open `.surpryze/agent-handoff.json` — field `skill.absolutePath` points at the packaged gap-analyst skill (or copy `skills/surpryze-gap-analyst/` into `.cursor/skills/`).
