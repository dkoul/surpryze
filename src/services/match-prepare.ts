import path from 'node:path';
import type { SurpryzeConfig } from '../knowledge/schemas.js';
import { openDatabase } from '../knowledge/db.js';
import { KnowledgeStore } from '../knowledge/store.js';
import { loadAssumptionGraph } from '../knowledge/graph-builder.js';
import { detectUiTestSuite } from '../ui-tests/detect.js';
import { buildUiTestDigest } from '../ui-tests/digest.js';
import { writeCoverageMatchTask } from '../coverage/match-task.js';

export async function runMatchPrepare(
  config: SurpryzeConfig,
  testsRoot?: string,
): Promise<void> {
  const uiRoot = path.resolve(testsRoot ?? config.uiTestsRoot ?? config.projectRoot);
  const suite = detectUiTestSuite(uiRoot);
  if (suite.testFiles.length === 0) {
    throw new Error(`No UI tests found at ${uiRoot} (Playwright, Cypress, or Selenium)`);
  }

  const db = openDatabase(config.surpryzeDir);
  const store = new KnowledgeStore(db, config.surpryzeDir);
  const graph = loadAssumptionGraph(store, []);

  if (graph.assumptions.length === 0) {
    throw new Error('Run `surpryze scan-app` first to build the application assumption graph.');
  }

  const digest = buildUiTestDigest(suite);
  const { promptPath, digestPath, outputPath } = writeCoverageMatchTask(
    config.surpryzeDir,
    graph,
    digest,
    uiRoot,
    suite.label,
  );

  store.setMeta('uiTestsRoot', uiRoot);
  store.setMeta('uiTestFramework', suite.framework);
  store.setMeta('semanticPhase', 'awaiting_coverage_matches');

  console.log(`UI tests: ${suite.label} — ${digest.length} cases at ${uiRoot}`);
  console.log(`Digest: ${digestPath}`);
  console.log(`Agent prompt: ${promptPath}`);
  console.log('');
  console.log('Run the Surpryze skill (step 2) and write:', outputPath);
  console.log('Then: npx surpryze match finalize');
}
