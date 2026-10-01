import path from 'node:path';
import fs from 'node:fs';
import type { SurpryzeConfig } from '../knowledge/schemas.js';
import { openDatabase } from '../knowledge/db.js';
import { KnowledgeStore } from '../knowledge/store.js';
import { assembleGraphView, type BuildGraphOptions } from '../knowledge/graph-builder.js';
import { applyCoverageMatches, loadCoverageMatches } from '../coverage/apply-matches.js';
import { COVERAGE_MATCHES_FILE } from '../coverage/match-task.js';
import { writeAssumptionGraphHtml } from '../reporting/graph-html.js';
import { writeAgentContext } from '../agent/context.js';
import { writeAgentHandoff } from '../agent/handoff.js';

export async function runMatchFinalize(
  config: SurpryzeConfig,
  matchesFile?: string,
): Promise<void> {
  const filePath = matchesFile ?? path.join(config.surpryzeDir, COVERAGE_MATCHES_FILE);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing ${filePath}. Complete step 2 in the Surpryze skill (semantic coverage match), then rerun.`,
    );
  }

  const matches = loadCoverageMatches(filePath);
  const db = openDatabase(config.surpryzeDir);
  const store = new KnowledgeStore(db, config.surpryzeDir);

  const links = applyCoverageMatches(store, matches);

  const buildOpts: BuildGraphOptions = {
    applicationSourceAvailable: true,
    semanticAnalyzer: 'coverage-match',
    graphOrigin: 'merged',
  };

  const graph = assembleGraphView(store, [], buildOpts);
  const graphPath = path.join(config.surpryzeDir, 'graph.json');
  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  writeAssumptionGraphHtml(graph, config.surpryzeDir);
  writeAgentContext(config.surpryzeDir, graph);
  writeAgentHandoff(config.surpryzeDir, config.projectRoot, graph);

  console.log(`Applied ${links} test→assumption coverage link(s).`);
  console.log(`Updated ${graphPath}`);
  console.log(`Uncovered assumptions: ${matches.uncoveredAssumptionIds?.length ?? 'see matches'}`);
}
