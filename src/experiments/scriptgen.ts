import fs from 'node:fs';
import path from 'node:path';
import type { PlannedExperiment } from './planner.js';

const DEFAULT_BASE_URL = process.env.SURPRYZE_BASE_URL ?? 'http://127.0.0.1:3456';

export function writeExperimentScript(
  experiment: PlannedExperiment,
  experimentsDir: string,
  baseUrl: string = DEFAULT_BASE_URL,
): string {
  fs.mkdirSync(experimentsDir, { recursive: true });
  const fileName = `${experiment.id}.spec.ts`;
  const filePath = path.join(experimentsDir, fileName);

  let body = '';
  if (experiment.template === 'multiple_reset_tokens') {
    body = `
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

async function appendObservation(entry: Record<string, unknown>) {
  const file = process.env.SURPRYZE_OBS_FILE;
  if (!file) return;
  let batch = { observations: [] as Record<string, unknown>[] };
  if (fs.existsSync(file)) {
    batch = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  batch.observations.push(entry);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(batch, null, 2));
}

test('surpryze experiment ${experiment.id}', async ({ request }) => {
  const email = 'multi-reset@example.com';
  await request.post('${baseUrl}/api/test/seed', {
    data: { email, password: 'ValidPass1!', active: true },
  });

  const r1 = await request.post('${baseUrl}/api/reset-request', { data: { email } });
  expect(r1.ok()).toBeTruthy();
  const j1 = await r1.json();
  const tokenA = j1.token as string;

  const r2 = await request.post('${baseUrl}/api/reset-request', { data: { email } });
  expect(r2.ok()).toBeTruthy();
  const j2 = await r2.json();
  const tokenB = j2.token as string;

  const useA = await request.post('${baseUrl}/api/reset-complete', {
    data: { token: tokenA, password: 'NewValidPass2!' },
  });
  const useB = await request.post('${baseUrl}/api/reset-complete', {
    data: { token: tokenB, password: 'NewValidPass3!' },
  });

  const observation = {
    experimentId: '${experiment.id}',
    tokenA: { status: useA.status(), body: await useA.json() },
    tokenB: { status: useB.status(), body: await useB.json() },
  };
  await appendObservation(observation);
});
`;
  } else if (experiment.template === 'deleted_account_reset') {
    body = `
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

async function appendObservation(entry: Record<string, unknown>) {
  const file = process.env.SURPRYZE_OBS_FILE;
  if (!file) return;
  let batch = { observations: [] as Record<string, unknown>[] };
  if (fs.existsSync(file)) {
    batch = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  batch.observations.push(entry);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(batch, null, 2));
}

test('surpryze experiment ${experiment.id}', async ({ request }) => {
  const email = 'deleted-user@example.com';
  await request.post('${baseUrl}/api/test/seed', {
    data: { email, password: 'ValidPass1!', active: true },
  });
  const del = await request.post('${baseUrl}/api/test/delete-user', { data: { email } });
  expect(del.ok()).toBeTruthy();

  const reset = await request.post('${baseUrl}/api/reset-request', { data: { email } });
  const body = await reset.json();

  await appendObservation({
    experimentId: '${experiment.id}',
    httpStatus: reset.status(),
    body,
  });
});
`;
  } else {
    body = `
import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

async function appendObservation(entry: Record<string, unknown>) {
  const file = process.env.SURPRYZE_OBS_FILE;
  if (!file) return;
  let batch = { observations: [] as Record<string, unknown>[] };
  if (fs.existsSync(file)) {
    batch = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  batch.observations.push(entry);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(batch, null, 2));
}

test('surpryze experiment ${experiment.id}', async () => {
  await appendObservation({ experimentId: '${experiment.id}', note: 'generic placeholder experiment' });
});
`;
  }

  fs.writeFileSync(filePath, body.trim() + '\n');
  return filePath;
}
