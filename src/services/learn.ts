import { openDatabase } from '../knowledge/db.js';
import { KnowledgeStore } from '../knowledge/store.js';
import { detectPlaywrightProject } from '../playwright/detect.js';
import { parseAllTestFiles } from '../parser/playwright-tests.js';
import { extractAndStoreAssumptions } from '../assumptions/extractor.js';
import type { SurpryzeConfig } from '../knowledge/schemas.js';

export async function runLearn(config: SurpryzeConfig): Promise<void> {
  const info = detectPlaywrightProject(config.projectRoot);
  const tests = parseAllTestFiles(info.testFiles, config.projectRoot);

  const db = openDatabase(config.surpryzeDir);
  const store = new KnowledgeStore(db);

  for (const t of tests) {
    store.upsertTest(t);
  }

  const assumptions = await extractAndStoreAssumptions(store, tests);

  store.setMeta('lastLearnAt', new Date().toISOString());
  store.setMeta('testsParsed', String(tests.length));
  store.setMeta('assumptionsCount', String(assumptions.length));

  console.log(`Learned from ${tests.length} tests, ${assumptions.length} assumptions.`);
}
