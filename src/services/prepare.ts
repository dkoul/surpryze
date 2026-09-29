import { openDatabase } from '../knowledge/db.js';
import { KnowledgeStore } from '../knowledge/store.js';
import { detectPlaywrightProject } from '../playwright/detect.js';
import { parseAllTestFiles } from '../parser/playwright-tests.js';
import type { SurpryzeConfig } from '../knowledge/schemas.js';
import { writeSemanticPrepareArtifacts } from '../agent/semantic-task.js';

export async function runPrepare(config: SurpryzeConfig): Promise<void> {
  const info = detectPlaywrightProject(config.projectRoot);
  const tests = parseAllTestFiles(info.testFiles, config.projectRoot);

  const db = openDatabase(config.surpryzeDir);
  const store = new KnowledgeStore(db, config.surpryzeDir);

  for (const t of tests) {
    store.upsertTest(t);
  }

  const { promptPath, digestPath, proposalsPath } = writeSemanticPrepareArtifacts(
    config.surpryzeDir,
    tests,
    config.projectRoot,
  );

  store.setMeta('lastPrepareAt', new Date().toISOString());
  store.setMeta('testsParsed', String(tests.length));
  store.setMeta('semanticPhase', 'awaiting_proposals');

  console.log(`Prepared ${tests.length} tests for semantic analysis.`);
  console.log(`Digest: ${digestPath}`);
  console.log(`Agent prompt: ${promptPath}`);
  console.log('');
  console.log('Next (Cursor / Claude Code):');
  console.log('  1. Open the Surpryze skill and follow AGENT-PROMPT.md');
  console.log(`  2. Write ${proposalsPath}`);
  console.log('  3. npx surpryze finalize');
}
