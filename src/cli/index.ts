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
import { runPrepare } from '../services/prepare.js';
import { runFinalize } from '../services/finalize.js';
import { SemanticAnalysisRequiredError } from '../agent/semantic-task.js';
import { buildAgentContextMarkdown, writeAgentContext } from '../agent/context.js';
import { loadPreviousSnapshot, computeConfidenceDeltas } from '../knowledge/confidence-run.js';
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
import { formatGapsReport } from '../graph/gaps-display.js';
import { formatLearnNextSteps } from '../agent/handoff.js';
import { runScanApp } from '../services/scan-app.js';
import { runMatchPrepare } from '../services/match-prepare.js';
import { runMatchFinalize } from '../services/match-finalize.js';
import { detectReactProject } from '../react/detect.js';

const program = new Command();

program
  .name('surpryze')
  .description('React assumption graph + semantic UI test coverage (Claude/Cursor skill)')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize Surpryze for a React app (and optional co-located UI tests)')
  .option('--root <path>', 'Project root', process.cwd())
  .option('--app-root <path>', 'React application root if different from --root')
  .option('--tests-root <path>', 'UI test repo root if separate from app')
  .action((opts: { root: string; appRoot?: string; testsRoot?: string }) => {
    const root = resolveProjectRoot(opts.root);
    const appRoot = opts.appRoot ? path.resolve(opts.appRoot) : root;
    const react = detectReactProject(appRoot);
    const config = defaultConfig(root);
    config.applicationRoot = appRoot;
    if (opts.testsRoot) config.uiTestsRoot = path.resolve(opts.testsRoot);
    const pw = detectPlaywrightProject(opts.testsRoot ? path.resolve(opts.testsRoot) : root);
    config.playwrightConfig = pw.playwrightConfig ?? undefined;
    config.testDir = pw.testDir;
    saveConfig(config);
    fs.mkdirSync(path.join(config.surpryzeDir, 'experiments'), { recursive: true });
    console.log(`Initialized Surpryze at ${surpryzeDir(root)}`);
    if (react) {
      console.log(`React app: ${react.sourceFiles.length} source files under ${appRoot}`);
    } else {
      console.warn(`Warning: no React app detected at ${appRoot}`);
    }
    if (pw.testFiles.length > 0) {
      console.log(`Co-located UI tests: ${pw.testFiles.length} Playwright files`);
    } else if (config.uiTestsRoot) {
      console.log(`UI tests root: ${config.uiTestsRoot}`);
    }
  });

program
  .command('scan-app')
  .description('Step 1: programmatic React scan → application assumption graph')
  .option('--root <path>', 'Surpryze project root', process.cwd())
  .action(async (opts: { root: string }) => {
    const root = resolveProjectRoot(opts.root);
    const config = loadConfig(root);
    await runScanApp(config);
  });

const match = program.command('match').description('Step 2: UI test coverage vs application graph (agent required)');

match
  .command('prepare')
  .description('Digest Playwright/Cypress/Selenium tests + agent prompt')
  .option('--root <path>', 'Surpryze project root', process.cwd())
  .option('--tests-root <path>', 'UI test codebase root (default: config uiTestsRoot or project root)')
  .action(async (opts: { root: string; testsRoot?: string }) => {
    const root = resolveProjectRoot(opts.root);
    const config = loadConfig(root);
    await runMatchPrepare(config, opts.testsRoot);
  });

match
  .command('finalize')
  .description('Apply agent coverage-matches.json to the graph')
  .option('--root <path>', 'Surpryze project root', process.cwd())
  .option('--matches-file <path>', 'Path to coverage-matches.json')
  .action(async (opts: { root: string; matchesFile?: string }) => {
    const root = resolveProjectRoot(opts.root);
    const config = loadConfig(root);
    await runMatchFinalize(config, opts.matchesFile);
  });

program
  .command('gaps')
  .description('Shorthand: gaps + SFDOT view (same data as graph, gaps section)')
  .option('--root <path>', 'Project root', process.cwd())
  .option('--json', 'Print testing-gaps.json payload')
  .action((opts: { root: string; json?: boolean }) => {
    const root = resolveProjectRoot(opts.root);
    const config = loadConfig(root);
    const store = new KnowledgeStore(openDatabase(config.surpryzeDir), config.surpryzeDir);
    const tests = store.listTests();
    const graph = loadAssumptionGraph(store, tests);
    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            assumptionsSummary: graph.assumptionsSummary,
            testingGaps: graph.testingGaps,
            whatToTestNext: graph.agentBrief.whatToTestNext,
            fidelityNote: graph.agentBrief.fidelityNote,
            coverageDisclaimer: graph.coverageDisclaimer,
            explorationCoverage: graph.explorationCoverage,
            sfdotCoverage: graph.sfdotCoverage,
          },
          null,
          2,
        ),
      );
    } else {
      console.log(formatGapsReport(graph));
    }
  });

program
  .command('graph')
  .description('Display the Assumption Graph (step 2: then use gap-analyst skill)')
  .option('--root <path>', 'Project root', process.cwd())
  .option('--json', 'Print machine-readable graph.json to stdout')
  .option('--no-gaps', 'Show assumption graph only (omit gaps + SFDOT summary)')
  .action((opts: { root: string; json?: boolean; noGaps?: boolean }) => {
    const root = resolveProjectRoot(opts.root);
    const config = loadConfig(root);
    const store = new KnowledgeStore(openDatabase(config.surpryzeDir), config.surpryzeDir);
    const tests = store.listTests();
    const graph = loadAssumptionGraph(store, tests);
    if (opts.json) {
      console.log(JSON.stringify(graph, null, 2));
      return;
    }
    const showGaps = !opts.noGaps;
    if (showGaps) {
      console.log(formatGapsReport(graph));
      console.log('');
      console.log('— Assumption graph (weakest first) —');
    }
    console.log(formatGraphReport(graph));
    const handoff = store.getMeta('agentHandoffPath');
    if (handoff) {
      console.log('');
      console.log(formatLearnNextSteps(handoff));
    }
  });

program
  .command('prepare')
  .description('Parse Playwright tests and write digest + agent prompt (step 1)')
  .option('--root <path>', 'Project root', process.cwd())
  .action(async (opts: { root: string }) => {
    const root = resolveProjectRoot(opts.root);
    const config = loadConfig(root);
    await runPrepare(config);
  });

program
  .command('finalize')
  .description('Merge agent semantic proposals → graph, report, agent-context (step 3)')
  .option('--root <path>', 'Project root', process.cwd())
  .option('--semantic-file <path>', 'Path to semantic-proposals.json')
  .option('--app-source', 'Application source was available to the agent')
  .option('--use-api', 'CI only: call OpenAI API instead of agent proposals file')
  .action(async (opts: { root: string; semanticFile?: string; appSource?: boolean; useApi?: boolean }) => {
    const root = resolveProjectRoot(opts.root);
    const config = loadConfig(root);
    try {
      await runFinalize(config, {
        semanticFile: opts.semanticFile,
        applicationSourceAvailable: opts.appSource ?? false,
        useApi: opts.useApi ?? false,
      });
    } catch (e) {
      if (e instanceof SemanticAnalysisRequiredError) {
        console.error(e.message);
        process.exit(1);
      }
      throw e;
    }
  });

program
  .command('analyze')
  .description('prepare + finalize when proposals exist; else prepares and instructs skill')
  .option('--root <path>', 'Project root', process.cwd())
  .option('--semantic-file <path>', 'Path to semantic-proposals.json')
  .option('--app-source', 'Application source repo is available as optional evidence')
  .option('--use-api', 'CI only: OpenAI API semantic pass (not the Cursor/Claude skill path)')
  .action(async (opts: { root: string; semanticFile?: string; appSource?: boolean; useApi?: boolean }) => {
    const root = resolveProjectRoot(opts.root);
    const config = loadConfig(root);
    try {
      await runFinalize(config, {
        semanticFile: opts.semanticFile,
        applicationSourceAvailable: opts.appSource ?? false,
        useApi: opts.useApi ?? false,
      });
    } catch (e) {
      if (e instanceof SemanticAnalysisRequiredError) {
        await runPrepare(config);
        console.error('');
        console.error(e.message);
        process.exit(1);
      }
      throw e;
    }
  });

program
  .command('context')
  .description('Generate or print agent-ready context (uncertainty-focused)')
  .option('--root <path>', 'Project root', process.cwd())
  .option('--assumption <id>', 'Focus on one assumption e.g. A-abc12345')
  .option('--weakest <n>', 'Include N weakest assumptions', '0')
  .action((opts: { root: string; assumption?: string; weakest: string }) => {
    const root = resolveProjectRoot(opts.root);
    const config = loadConfig(root);
    const store = new KnowledgeStore(openDatabase(config.surpryzeDir), config.surpryzeDir);
    const tests = store.listTests();
    const graph = loadAssumptionGraph(store, tests);
    const weakestN = parseInt(opts.weakest, 10);
    const previous = loadPreviousSnapshot(config.surpryzeDir);
    const focused = Boolean(opts.assumption) || weakestN > 0;
    const options = {
      assumptionId: opts.assumption,
      weakest: weakestN > 0 ? weakestN : focused ? undefined : 12,
      confidenceDeltas: computeConfidenceDeltas(graph, previous),
    };
    if (focused) {
      console.log(buildAgentContextMarkdown(graph, options));
      return;
    }
    const out = writeAgentContext(config.surpryzeDir, graph, options);
    console.log(`Wrote ${out}`);
  });

program
  .command('learn')
  .description('Alias for surpryze analyze')
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
