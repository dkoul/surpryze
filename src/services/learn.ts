import type { SurpryzeConfig } from '../knowledge/schemas.js';
import { runPrepare } from './prepare.js';

/** @deprecated Use prepare → Surpryze skill → finalize */
export async function runLearn(config: SurpryzeConfig): Promise<void> {
  console.log('`surpryze learn` → `surpryze prepare` (semantic analysis is required via the Surpryze skill).');
  await runPrepare(config);
}
