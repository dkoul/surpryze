import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { ParsedTest } from '../knowledge/schemas.js';
import { parseAllTestFiles } from '../parser/playwright-tests.js';
import type { UiTestSuiteInfo } from './detect.js';

export interface UiTestDigestEntry {
  id: string;
  framework: string;
  filePath: string;
  title: string;
  actions: string[];
  assertions: string[];
  routes: string[];
  apiCalls: string[];
  excerpt: string;
}

function hashTestId(filePath: string, title: string): string {
  return 'UT-' + createHash('sha256').update(`${filePath}|${title}`).digest('hex').slice(0, 8);
}

function digestCypressFile(filePath: string, root: string): UiTestDigestEntry[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const rel = filePath.replace(root, '').replace(/^\//, '');
  const entries: UiTestDigestEntry[] = [];
  const blocks = content.split(/\bit\s*\(\s*['"`]/);
  for (let i = 1; i < blocks.length; i++) {
    const titleMatch = blocks[i].match(/^([^'"`]+)['"`]/);
    const title = titleMatch?.[1] ?? `case-${i}`;
    const body = blocks[i].slice(titleMatch?.[0].length ?? 0, 800);
    const actions: string[] = [];
    const assertions: string[] = [];
    if (body.includes('cy.visit')) actions.push('cy.visit');
    if (body.includes('cy.get')) actions.push('cy.get');
    if (body.includes('cy.click')) actions.push('cy.click');
    if (body.includes('should(')) assertions.push('cy.should(...)');
    entries.push({
      id: hashTestId(filePath, title),
      framework: 'cypress',
      filePath: rel,
      title,
      actions,
      assertions,
      routes: [],
      apiCalls: [],
      excerpt: body.slice(0, 400).trim(),
    });
  }
  if (entries.length === 0) {
    entries.push({
      id: hashTestId(filePath, path.basename(filePath)),
      framework: 'cypress',
      filePath: rel,
      title: path.basename(filePath),
      actions: [],
      assertions: [],
      routes: [],
      apiCalls: [],
      excerpt: content.slice(0, 500),
    });
  }
  return entries;
}

function digestSeleniumFile(filePath: string, root: string): UiTestDigestEntry[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const rel = filePath.replace(root, '').replace(/^\//, '');
  return [
    {
      id: hashTestId(filePath, path.basename(filePath)),
      framework: 'selenium',
      filePath: rel,
      title: path.basename(filePath),
      actions: content.match(/\.(click|sendKeys|get)\(/g) ?? [],
      assertions: content.match(/assert|expect\(/gi) ?? [],
      routes: [],
      apiCalls: [],
      excerpt: content.slice(0, 500),
    },
  ];
}

function parsedToDigest(t: ParsedTest, framework: string): UiTestDigestEntry {
  return {
    id: t.id,
    framework,
    filePath: t.filePath,
    title: t.title,
    actions: t.actions,
    assertions: t.assertions,
    routes: t.routes,
    apiCalls: t.apiCalls,
    excerpt: (t.rawSnippet ?? t.assertions.join('; ')).slice(0, 400),
  };
}

export function buildUiTestDigest(suite: UiTestSuiteInfo): UiTestDigestEntry[] {
  if (suite.framework === 'playwright') {
    const parsed = parseAllTestFiles(suite.testFiles, suite.root);
    return parsed.map((t) => parsedToDigest(t, 'playwright'));
  }
  if (suite.framework === 'cypress') {
    return suite.testFiles.flatMap((f) => digestCypressFile(f, suite.root));
  }
  if (suite.framework === 'selenium') {
    return suite.testFiles.flatMap((f) => digestSeleniumFile(f, suite.root));
  }
  return [];
}
