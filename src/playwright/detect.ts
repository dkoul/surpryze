import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

export interface PlaywrightProjectInfo {
  root: string;
  playwrightConfig: string | null;
  testDir: string;
  testFiles: string[];
}

export function detectPlaywrightProject(root: string): PlaywrightProjectInfo {
  const candidates = [
    'playwright.config.ts',
    'playwright.config.js',
    'playwright.config.mjs',
  ];
  let playwrightConfig: string | null = null;
  for (const c of candidates) {
    const full = path.join(root, c);
    if (fs.existsSync(full)) {
      playwrightConfig = full;
      break;
    }
  }

  let testDir = 'tests';
  if (playwrightConfig) {
    const content = fs.readFileSync(playwrightConfig, 'utf8');
    const m = content.match(/testDir:\s*['"]([^'"]+)['"]/);
    if (m) testDir = m[1];
  }

  const patterns = [
    path.join(root, testDir, '**/*.{spec,test}.{ts,js,mjs}'),
    path.join(root, '**/*.{spec,test}.{ts,js,mjs}'),
  ];
  const files = new Set<string>();
  for (const pattern of patterns) {
    for (const f of glob.sync(pattern, { nodir: true, ignore: ['**/node_modules/**', '**/.surpryze/**'] })) {
      files.add(path.resolve(f));
    }
  }

  return {
    root,
    playwrightConfig,
    testDir: path.join(root, testDir),
    testFiles: [...files].sort(),
  };
}
