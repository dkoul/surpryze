import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parsePlaywrightFile } from '../../src/parser/playwright-tests.js';
import { mineAssumptionGraph } from '../../src/assumptions/mine.js';
import { assertionToBelief } from '../../src/assumptions/beliefs.js';

test('parses standard expect().toBeVisible() chains', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'surpryze-'));
  const file = path.join(dir, 'sample.spec.ts');
  fs.writeFileSync(
    file,
    `
import { test, expect } from '@playwright/test';
test.describe('Checkout', () => {
  test('shows confirmation', async ({ page }) => {
    await page.goto('/done');
    await expect(page.getByRole('heading')).toBeVisible();
  });
});
`,
  );
  const parsed = parsePlaywrightFile(file, dir);
  expect(parsed.length).toBe(1);
  expect(parsed[0].assertions.length).toBeGreaterThan(0);

  const mined = mineAssumptionGraph(parsed);
  expect(mined.bundles.length).toBeGreaterThan(0);
  const edges = mined.bundles.flatMap((b) => b.edges);
  expect(edges.some((e) => e.toKind === 'assumption')).toBe(true);
});

test('extracts literal text expectations into precise claims', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'surpryze-'));
  const file = path.join(dir, 'text.spec.ts');
  fs.writeFileSync(
    file,
    `
import { test, expect } from '@playwright/test';
test('welcome message', async ({ page }) => {
  await expect(page.getByText('Welcome back')).toHaveText('Welcome back');
});
`,
  );
  const parsed = parsePlaywrightFile(file, dir);
  const detail = parsed[0].assertionDetails?.find((a) => a.matcher?.includes('toHaveText'));
  expect(detail?.expectedLiterals).toContain('"Welcome back"');
  const belief = assertionToBelief(detail!, parsed[0]);
  expect(belief.precision).toBe('literal');
  expect(belief.statement).toContain('Welcome back');
});
