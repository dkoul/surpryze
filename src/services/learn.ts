import { openDatabase } from '../knowledge/db.js';
import { KnowledgeStore } from '../knowledge/store.js';
import { detectPlaywrightProject } from '../playwright/detect.js';
import { parseAllTestFiles } from '../parser/playwright-tests.js';
import { buildAndPersistAssumptionGraph } from '../knowledge/graph-builder.js';
import type { SurpryzeConfig } from '../knowledge/schemas.js';
import { formatGraphReport } from '../graph/display.js';

export async function runLearn(config: SurpryzeConfig): Promise<void> {
  const info = detectPlaywrightProject(config.projectRoot);
  const tests = parseAllTestFiles(info.testFiles, config.projectRoot);

  const db = openDatabase(config.surpryzeDir);
  const store = new KnowledgeStore(db, config.surpryzeDir);

  for (const t of tests) {
    store.upsertTest(t);
  }

  const graph = buildAndPersistAssumptionGraph(store, tests);

  store.setMeta('lastLearnAt', new Date().toISOString());
  store.setMeta('testsParsed', String(tests.length));
  store.setMeta('assumptionsCount', String(graph.projectSummary.assumptions));

  console.log(`Learned from ${tests.length} tests → ${graph.projectSummary.assumptions} assumptions in graph.`);
  console.log(`Wrote ${config.surpryzeDir}/assumption-graph.json`);
  console.log('');
  console.log(formatGraphReport(graph));
}
