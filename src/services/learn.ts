import type { SurpryzeConfig } from '../knowledge/schemas.js';
import { runAnalyze } from './analyze.js';

/** @deprecated Use `surpryze analyze` — learn is an alias for the full analysis pipeline. */
export async function runLearn(config: SurpryzeConfig): Promise<void> {
  console.log('Note: `surpryze learn` is an alias for `surpryze analyze`.');
  await runAnalyze(config);
}
