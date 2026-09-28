#!/usr/bin/env node
import { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs';
import {
  defaultConfig,
  loadConfig,
  resolveProjectRoot,
  saveConfig,
  surpryzeDir,
} from '../config.js';
import { detectPlaywrightProject } from '../playwright/detect.js';
import { runLearn } from '../services/learn.js';
import { runExplorePipeline } from '../services/explore.js';
import { openDatabase } from '../knowledge/db.js';
import { KnowledgeStore } from '../knowledge/store.js';
import { writeHtmlReport } from '../reporting/html.js';
import { writeJsonReport } from '../reporting/json.js';
import { buildInvestigationBrief, classifySurprise } from '../investigation/engine.js';
import { computeMetrics } from '../reporting/metrics.js';
import type { InvestigationClassification } from '../investigation/engine.js';
import { loadAssumptionGraph } from '../knowledge/graph-builder.js';
import { formatGraphReport } from '../graph/display.js';

const program = new Command();

program
  .name('surpryze')
  .description('Epistemic testing layer for Playwright')
  .version('0.1.0');

program
  .command('init')
  .description('Detect Playwright project and initialize Surpryze')
  .option('--root <path>', 'Project root', process.cwd())
  .action((opts: { root: string }) => {
    const root = resolveProjectRoot(opts.root);
    const info = detectPlaywrightProject(root);
    const config = defaultConfig(root);
    config.playwrightConfig = info.playwrightConfig ?? undefined;
    config.testDir = info.testDir;
    saveConfig(config);
    fs.mkdirSync(path.join(config.surpryzeDir, 'experiments'), { recursive: true });
    console.log(`Initialized Surpryze at ${surpryzeDir(root)}`);
    console.log(`Detected ${info.testFiles.length} test files`);
  });

program
  .command('graph')
  .description('Display the Assumption Graph (weakest assumptions first)')
  .option('--root <path>', 'Project root', process.cwd())
  .option('--json', 'Print machine-readable assumption-graph.json to stdout')
  .action((opts: { root: string; json?: boolean }) => {
    const root = resolveProjectRoot(opts.root);
    const config = loadConfig(root);
    const store = new KnowledgeStore(openDatabase(config.surpryzeDir), config.surpryzeDir);
    const tests = store.listTests();
    const graph = loadAssumptionGraph(store, tests);
    if (opts.json) {
      console.log(JSON.stringify(graph, null, 2));
    } else {
      console.log(formatGraphReport(graph));
    }
  });

program
  .command('learn')
  .description('Parse tests and build the Assumption Graph')
  .option('--root <path>', 'Project root', process.cwd())
  .action(async (opts: { root: string }) => {
    const root = resolveProjectRoot(opts.root);
    const config = loadConfig(root);
    await runLearn(config);
  });

program
  .command('explore')
  .description('Generate and run bounded experiments')
  .option('--root <path>', 'Project root', process.cwd())
  .option('--budget <n>', 'Max experiments', '20')
  .option('--base-url <url>', 'Application base URL')
  .action(async (opts: { root: string; budget: string; baseUrl?: string }) => {
    const root = resolveProjectRoot(opts.root);
    const config = loadConfig(root);
    const budget = parseInt(opts.budget, 10);
    await runExplorePipeline(config, budget, opts.baseUrl);
  });

program
  .command('investigate')
  .description('Investigate a surprise')
  .argument('<surpriseId>', 'Surprise id e.g. SURPRISE-abc123')
  .option('--root <path>', 'Project root', process.cwd())
  .option('--classify <kind>', 'Classification when resolving')
  .option('--note <text>', 'Human note')
  .option(
    '--decision <d>',
    'ACCEPTED_DEFECT | ACCEPTED_EXPECTED | EXPLAINED | IGNORED',
  )
  .action((surpriseId: string, opts: { root: string; classify?: string; note?: string; decision?: string }) => {
    const root = resolveProjectRoot(opts.root);
    const config = loadConfig(root);
    const store = new KnowledgeStore(openDatabase(config.surpryzeDir), config.surpryzeDir);
    const brief = buildInvestigationBrief(store, surpriseId);
    if (!brief) {
      console.error(`Surprise not found: ${surpriseId}`);
      process.exit(1);
    }
    console.log(JSON.stringify(brief, null, 2));
    if (opts.classify) {
      classifySurprise(
        store,
        surpriseId,
        opts.classify as InvestigationClassification,
        opts.note,
        opts.decision as 'ACCEPTED_DEFECT' | 'ACCEPTED_EXPECTED' | 'EXPLAINED' | 'IGNORED' | undefined,
      );
      console.log(`Updated ${surpriseId}`);
    }
  });

program
  .command('report')
  .description('Generate HTML and JSON reports')
  .option('--root <path>', 'Project root', process.cwd())
  .action((opts: { root: string }) => {
    const root = resolveProjectRoot(opts.root);
    const config = loadConfig(root);
    const store = new KnowledgeStore(openDatabase(config.surpryzeDir), config.surpryzeDir);
    const html = writeHtmlReport(store, config.surpryzeDir);
    const json = writeJsonReport(store, config.surpryzeDir);
    console.log(`Wrote ${html}`);
    console.log(`Wrote ${json}`);
  });

program
  .command('status')
  .description('Show knowledge model status')
  .option('--root <path>', 'Project root', process.cwd())
  .action((opts: { root: string }) => {
    const root = resolveProjectRoot(opts.root);
    const config = loadConfig(root);
    const store = new KnowledgeStore(openDatabase(config.surpryzeDir), config.surpryzeDir);
    const m = computeMetrics(store);
    console.log('SURPRYZE STATUS');
    console.log(`  Tests: ${m.testsAnalyzed}`);
    console.log(`  Assumptions: ${m.assumptionsDiscovered}`);
    console.log(`  Experiments: ${m.experimentsRun}`);
    console.log(`  Surprises (unexplained): ${m.unexplained}`);
    console.log(`  Epistemic coverage: ${m.epistemicCoverage}%`);
    console.log(`  Last learn: ${store.getMeta('lastLearnAt') ?? 'never'}`);
    console.log(`  Last explore: ${store.getMeta('lastExploreAt') ?? 'never'}`);
  });

program.parse();
