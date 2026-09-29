# Surpryze Product Reset PRD

This document is the source-of-truth product definition for the MVP reset.

## Thesis

> Code graphs describe what software contains.  
> Assumption Graphs describe what teams believe software does.  
> Surpryze makes those beliefs visible, measures the evidence behind them, and exposes what remains unknown.

## Delivery model

Surpryze ships as a **Cursor / Claude Code skill** (`skills/surpryze/`). The CLI parses tests and computes evidence; **the host LLM is mandatory** for semantic analysis (`semantic-proposals.json`). There is no optional heuristic-only mode.

## MVP workflow

`prepare → (skill / agent semantic analysis) → finalize → graph → context`

| Command | Role |
|---------|------|
| `surpryze prepare` | Structural digest + agent prompt |
| *(skill)* | Agent writes `semantic-proposals.json` |
| `surpryze finalize` | Graph, report, agent-context |
| `surpryze graph` | Inspect current graph |
| `surpryze context` | Agent-ready markdown (`--assumption`, `--weakest`) |

## Outputs

- `.surpryze/graph.json` — structured Assumption Graph  
- `.surpryze/report.html` — human report  
- `.surpryze/agent-context.md` — what uncertainty exists and why  

## Boundaries

- Test repository is sufficient; application source is optional evidence.  
- Unknown application behavior is represented as **unknown**, not inferred false.  
- Gaps are not automatic defects.  
- Confidence is evidence-derived; LLM supplies semantics, not scores.  
- Exploration dimensions (behavior, data, state, platform, operations, time) guide gap discovery without third-party heuristic branding.

## What Surpryze is not

- Not primarily an AI test generator  
- Not primarily an autonomous browser agent for MVP  
- Does not optimize for count of generated tests  

## Success

Given a Playwright repo, Surpryze explains **what tests believe, why, how strong the evidence is, and which assumptions remain weak or unknown**—and a developer can feed `agent-context.md` to a coding agent to add tests that **measurably increase evidence** on the next `analyze` run.
