import fs from 'node:fs';
import { proposalsPath, SemanticAnalysisRequiredError } from '../agent/semantic-task.js';
import type { SurpryzeConfig } from '../knowledge/schemas.js';
import { runAnalyze, type AnalyzeResult } from './analyze.js';

export interface FinalizeOptions {
  semanticFile?: string;
  applicationSourceAvailable?: boolean;
  useApi?: boolean;
}

export async function runFinalize(
  config: SurpryzeConfig,
  options: FinalizeOptions = {},
): Promise<AnalyzeResult> {
  const defaultFile = proposalsPath(config.surpryzeDir);
  const semanticFile =
    options.semanticFile ?? (fs.existsSync(defaultFile) ? defaultFile : undefined);

  if (!semanticFile && !options.useApi) {
    throw new SemanticAnalysisRequiredError(
      `Missing ${defaultFile}. Run \`surpryze prepare\`, complete semantic analysis via the Surpryze skill, then \`surpryze finalize\`.`,
    );
  }

  return runAnalyze(config, {
    applicationSourceAvailable: options.applicationSourceAvailable,
    semanticProposalsFile: semanticFile,
    useApi: options.useApi,
  });
}
