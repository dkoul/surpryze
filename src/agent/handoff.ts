import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AssumptionGraph } from '../knowledge/schemas.js';

function surpryzePackageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export interface AgentHandoff {
  version: 1;
  workflow: ['learn', 'graph', 'surpryze-gap-analyst'];
  generatedAt: string;
  projectRoot: string;
  artifacts: {
    assumptionGraph: string;
    testingGaps: string;
    knowledgeDb: string;
  };
  skill: {
    id: 'surpryze-gap-analyst';
    relativePath: string;
    absolutePath: string;
    description: string;
  };
  summary: {
    testsAnalyzed: number;
    assumptions: number;
    edges: number;
    testingGaps: number;
    thinSfdotDimensions: string[];
    literalClaims: number;
    intentClaims: number;
  };
  rules: {
    coverageDisclaimer: string;
    fidelityNote: string;
  };
  nextSteps: string[];
}

export function writeAgentHandoff(
  surpryzeDir: string,
  projectRoot: string,
  graph: AssumptionGraph,
): string {
  const handoffPath = path.join(surpryzeDir, 'agent-handoff.json');
  const skillRelative = 'skills/surpryze-gap-analyst/SKILL.md';
  const skillAbsolute = path.join(surpryzePackageRoot(), skillRelative);

  const payload: AgentHandoff = {
    version: 1,
    workflow: ['learn', 'graph', 'surpryze-gap-analyst'],
    generatedAt: graph.generatedAt,
    projectRoot,
    artifacts: {
      assumptionGraph: path.join(surpryzeDir, 'assumption-graph.json'),
      testingGaps: path.join(surpryzeDir, 'testing-gaps.json'),
      knowledgeDb: path.join(surpryzeDir, 'knowledge.db'),
    },
    skill: {
      id: 'surpryze-gap-analyst',
      relativePath: skillRelative,
      absolutePath: skillAbsolute,
      description:
        'Subagent/skill: read assumption-graph.json and suggest test gaps, data variation, and flows with grounded IDs.',
    },
    summary: {
      testsAnalyzed: graph.projectSummary.testsAnalyzed,
      assumptions: graph.projectSummary.assumptions,
      edges: graph.projectSummary.edges,
      testingGaps: graph.projectSummary.testingGaps,
      thinSfdotDimensions: graph.sfdotCoverage.thinDimensions,
      literalClaims: graph.assumptionsSummary.literalClaims,
      intentClaims: graph.assumptionsSummary.intentClaims,
    },
    rules: {
      coverageDisclaimer: graph.coverageDisclaimer,
      fidelityNote: graph.agentBrief.fidelityNote,
    },
    nextSteps: [
      'npx surpryze graph',
      'npx surpryze graph --json  # full graph for agents',
      `Open skill: ${skillRelative} (surpryze-gap-analyst)`,
      'Gap analyst: read assumption-graph.json + agent-handoff.json; output grounded suggestions',
    ],
  };

  fs.writeFileSync(handoffPath, JSON.stringify(payload, null, 2));
  return handoffPath;
}

export function formatLearnNextSteps(handoffPath: string): string {
  return [
    'Next steps:',
    '  1. npx surpryze graph          # human-readable graph',
    '  2. npx surpryze graph --json   # full payload for agents',
    '  3. Gap analyst skill           # skills/surpryze-gap-analyst/SKILL.md',
    `     Handoff: ${handoffPath}`,
  ].join('\n');
}
