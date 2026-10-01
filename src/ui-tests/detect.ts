import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { detectPlaywrightProject } from '../playwright/detect.js';

export type UiTestFramework = 'playwright' | 'cypress' | 'selenium' | 'unknown';

export interface UiTestSuiteInfo {
  root: string;
  framework: UiTestFramework;
  testFiles: string[];
  label: string;
}

function detectCypress(root: string): UiTestSuiteInfo | null {
  const hasConfig =
    fs.existsSync(path.join(root, 'cypress.config.ts')) ||
    fs.existsSync(path.join(root, 'cypress.config.js'));
  const cypressDir = path.join(root, 'cypress');
  const patterns = hasConfig || fs.existsSync(cypressDir)
    ? [
        path.join(root, 'cypress/e2e/**/*.{cy,spec}.{ts,js}'),
        path.join(root, '**/*.cy.{ts,js}'),
      ]
    : [path.join(root, '**/*.cy.{ts,js}')];
  const files = new Set<string>();
  for (const p of patterns) {
    for (const f of glob.sync(p, { nodir: true, ignore: ['**/node_modules/**'] })) {
      files.add(path.resolve(f));
    }
  }
  if (files.size === 0) return null;
  return {
    root,
    framework: 'cypress',
    testFiles: [...files].sort(),
    label: 'Cypress',
  };
}

function detectSelenium(root: string): UiTestSuiteInfo | null {
  const patterns = [
    path.join(root, '**/*selenium*.{ts,js,java}'),
    path.join(root, '**/tests/**/*.{ts,js}'),
  ];
  const files: string[] = [];
  for (const p of patterns) {
    for (const f of glob.sync(p, { nodir: true, ignore: ['**/node_modules/**'] })) {
      const content = fs.readFileSync(f, 'utf8');
      if (
        /selenium-webdriver|webdriver\.io|from\s+['"]selenium|WebDriver/i.test(content) &&
        !/playwright|@playwright/.test(content)
      ) {
        files.push(path.resolve(f));
      }
    }
  }
  if (files.length === 0) return null;
  return {
    root,
    framework: 'selenium',
    testFiles: [...files].sort(),
    label: 'Selenium/WebDriver',
  };
}

export function detectUiTestSuite(root: string): UiTestSuiteInfo {
  const pw = detectPlaywrightProject(root);
  if (pw.testFiles.length > 0) {
    return {
      root,
      framework: 'playwright',
      testFiles: pw.testFiles,
      label: 'Playwright',
    };
  }
  const cy = detectCypress(root);
  if (cy) return cy;
  const se = detectSelenium(root);
  if (se) return se;
  return { root, framework: 'unknown', testFiles: [], label: 'none' };
}
