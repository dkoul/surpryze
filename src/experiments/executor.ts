import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { SurpryzeConfig } from '../knowledge/schemas.js';
import type { KnowledgeStore } from '../knowledge/store.js';
import { planExperiments, type PlannedExperiment } from './planner.js';
import { writeExperimentScript } from './scriptgen.js';

export interface ExecuteResult {
  experiments: PlannedExperiment[];
  observationFile: string;
}

export async function runExplore(
  config: SurpryzeConfig,
  store: KnowledgeStore,
  budget: number,
  baseUrl?: string,
): Promise<ExecuteResult> {
  const assumptions = store.listAssumptions();
  const planned = planExperiments(assumptions, budget);
  const experimentsDir = path.join(config.surpryzeDir, 'experiments');
  const observationsPath = path.join(config.surpryzeDir, 'last-observations.json');

  fs.writeFileSync(observationsPath, JSON.stringify({ observations: [] }));

  for (const exp of planned) {
    const scriptPath = writeExperimentScript(exp, experimentsDir, baseUrl);
    exp.scriptPath = scriptPath;
    store.upsertExperiment(exp);
  }

  if (planned.length === 0) {
    return { experiments: [], observationFile: observationsPath };
  }

  const pwConfig = path.join(config.surpryzeDir, 'playwright.experiments.config.ts');
  writeExperimentPlaywrightConfig(pwConfig, config.projectRoot, experimentsDir);

  await runPlaywright(pwConfig, config.projectRoot, {
    SURPRYZE_OBS_FILE: observationsPath,
    SURPRYZE_BASE_URL: baseUrl ?? process.env.SURPRYZE_BASE_URL ?? 'http://127.0.0.1:3456',
  });

  return { experiments: planned, observationFile: observationsPath };
}

function writeExperimentPlaywrightConfig(configPath: string, projectRoot: string, testDir: string): void {
  const content = `
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '${testDir.replace(/\\/g, '/')}',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.SURPRYZE_BASE_URL ?? 'http://127.0.0.1:3456',
    trace: 'on-first-retry',
  },
  reporter: [['list']],
});
`;
  fs.writeFileSync(configPath, content.trim() + '\n');
}

function runPlaywright(
  configPath: string,
  cwd: string,
  extraEnv: Record<string, string>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['playwright', 'test', '--config', configPath],
      {
        cwd,
        env: { ...process.env, ...extraEnv },
        stdio: 'inherit',
        shell: true,
      },
    );
    child.on('error', reject);
    child.on('close', (code) => {
      // Experiments may "fail" from Playwright's view but still produce observations
      if (code !== 0 && code !== null) {
        // continue — surprise pipeline reads observation file from demo app hooks
      }
      resolve();
    });
  });
}
