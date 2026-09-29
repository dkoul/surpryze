import { openDatabase } from '../knowledge/db.js';
import { KnowledgeStore } from '../knowledge/store.js';
import { detectPlaywrightProject } from '../playwright/detect.js';
import { parseAllTestFiles } from '../parser/playwright-tests.js';
import type { SurpryzeConfig } from '../knowledge/schemas.js';
import {
  buildAndPersistAssumptionGraph,
  type BuildGraphOptions,
} from '../knowledge/graph-builder.js';
import { resolveSemanticAnalyzer } from '../llm/semantic.js';
import {
  computeConfidenceDeltas,
  loadPreviousSnapshot,
  recordConfidenceRun,
} from '../knowledge/confidence-run.js';
import { writeAgentContext } from '../agent/context.js';
import { semanticDir } from '../agent/semantic-task.js';
import fs from 'node:fs';
import path from 'node:path';

export interface AnalyzeResult {
  graphPath: string;
  reportPath: string;
  contextPath: string;
  confidenceDeltas: ReturnType<typeof computeConfidenceDeltas>;
  semanticAnalyzer: string;
}

export interface AnalyzeOptions {
  evidenceContext?: string;
  applicationSourceAvailable?: boolean;
  semanticProposalsFile?: string;
  useApi?: boolean;
}

export async function runAnalyze(
  config: SurpryzeConfig,
  options: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  const info = detectPlaywrightProject(config.projectRoot);
  const tests = parseAllTestFiles(info.testFiles, config.projectRoot);

  const db = openDatabase(config.surpryzeDir);
  const store = new KnowledgeStore(db, config.surpryzeDir);

  for (const t of tests) {
    store.upsertTest(t);
  }

  const previous = loadPreviousSnapshot(config.surpryzeDir);
  const analyzer = resolveSemanticAnalyzer({
    proposalsFile: options.semanticProposalsFile,
    allowApiFallback: options.useApi ?? false,
  });
  const semanticProposals = await analyzer.analyzeTests(tests, options.evidenceContext);

  const buildOpts: BuildGraphOptions = {
    semanticProposals,
    semanticAnalyzer: analyzer.name,
    applicationSourceAvailable: options.applicationSourceAvailable ?? false,
  };

  const graph = buildAndPersistAssumptionGraph(store, tests, config.projectRoot, buildOpts);

  const contextPath = writeAgentContext(config.surpryzeDir, graph, {
    confidenceDeltas: computeConfidenceDeltas(graph, previous),
  });

  recordConfidenceRun(store, graph);

  store.setMeta('lastAnalyzeAt', new Date().toISOString());
  store.setMeta('lastLearnAt', new Date().toISOString());
  store.setMeta('testsParsed', String(tests.length));
  store.setMeta('assumptionsCount', String(graph.projectSummary.assumptions));
  store.setMeta('semanticAnalyzer', analyzer.name);
  store.setMeta('semanticPhase', 'complete');

  fs.writeFileSync(
    path.join(semanticDir(config.surpryzeDir), 'status.json'),
    JSON.stringify({ phase: 'complete', completedAt: graph.generatedAt }, null, 2),
  );

  const graphPath = path.join(config.surpryzeDir, 'graph.json');
  const reportPath = path.join(config.surpryzeDir, 'report.html');

  const deltas = computeConfidenceDeltas(graph, previous);

  console.log(
    `Analyzed ${tests.length} tests → ${graph.projectSummary.assumptions} assumptions (semantic: ${analyzer.name}).`,
  );
  console.log(`Wrote ${graphPath}`);
  console.log(`Wrote ${reportPath}`);
  console.log(`Wrote ${contextPath}`);
  if (deltas.length > 0) {
    console.log(`Confidence changes: ${deltas.length} assumption(s) moved since last run.`);
    for (const d of deltas.slice(0, 5)) {
      const sign = (d.delta ?? 0) > 0 ? '+' : '';
      console.log(`  ${d.assumptionId}: ${sign}${((d.delta ?? 0) * 100).toFixed(1)}%`);
    }
  }
  console.log('');
  console.log('Next: `surpryze graph` · `surpryze context`');

  return {
    graphPath,
    reportPath,
    contextPath,
    confidenceDeltas: deltas,
    semanticAnalyzer: analyzer.name,
  };
}
