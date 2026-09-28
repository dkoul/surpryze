import { openDatabase } from '../knowledge/db.js';
import { KnowledgeStore } from '../knowledge/store.js';
import { detectPlaywrightProject } from '../playwright/detect.js';
import { parseAllTestFiles } from '../parser/playwright-tests.js';
import { buildAndPersistAssumptionGraph } from '../knowledge/graph-builder.js';
import type { SurpryzeConfig } from '../knowledge/schemas.js';
import { formatLearnNextSteps } from '../agent/handoff.js';

export async function runLearn(config: SurpryzeConfig): Promise<void> {
  const info = detectPlaywrightProject(config.projectRoot);
  const tests = parseAllTestFiles(info.testFiles, config.projectRoot);

  const db = openDatabase(config.surpryzeDir);
  const store = new KnowledgeStore(db, config.surpryzeDir);

  for (const t of tests) {
    store.upsertTest(t);
  }

  const graph = buildAndPersistAssumptionGraph(store, tests, config.projectRoot);

  store.setMeta('lastLearnAt', new Date().toISOString());
  store.setMeta('testsParsed', String(tests.length));
  store.setMeta('assumptionsCount', String(graph.projectSummary.assumptions));

  const handoffPath = store.getMeta('agentHandoffPath') ?? `${config.surpryzeDir}/agent-handoff.json`;

  console.log(
    `Learned from ${tests.length} tests → ${graph.projectSummary.assumptions} assumptions, ${graph.projectSummary.testingGaps} heuristic gaps.`,
  );
  if (tests.length > 0 && graph.projectSummary.assumptions === 0) {
    console.warn(
      'Warning: no assumptions extracted. Ensure tests use expect(...).matcher() and are .spec.ts / .test.ts (or .js) under your Playwright testDir.',
    );
  }
  console.log(`Wrote ${config.surpryzeDir}/assumption-graph.json`);
  console.log(`Wrote ${handoffPath}`);
  console.log('');
  console.log(formatLearnNextSteps(handoffPath));
}
