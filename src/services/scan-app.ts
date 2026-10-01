import path from 'node:path';
import type { SurpryzeConfig } from '../knowledge/schemas.js';
import { detectReactProject } from '../react/detect.js';
import { scanReactProject } from '../react/scan.js';
import { bundlesFromAppCandidates } from '../react/app-graph.js';
import { openDatabase } from '../knowledge/db.js';
import { KnowledgeStore } from '../knowledge/store.js';
import {
  assembleGraphView,
  type BuildGraphOptions,
} from '../knowledge/graph-builder.js';
import fs from 'node:fs';
import { writeAssumptionGraphHtml } from '../reporting/graph-html.js';
import { writeAgentHandoff } from '../agent/handoff.js';

export async function runScanApp(config: SurpryzeConfig): Promise<void> {
  const appRoot = path.resolve(config.applicationRoot ?? config.projectRoot);
  const react = detectReactProject(appRoot, config.reactSourceDirs);
  if (!react) {
    throw new Error(`No React application detected at ${appRoot}`);
  }

  const { signals, candidates } = scanReactProject(react.sourceFiles);
  const bundles = bundlesFromAppCandidates(candidates);

  const db = openDatabase(config.surpryzeDir);
  const store = new KnowledgeStore(db, config.surpryzeDir);
  store.clearGraphArtifacts();

  const lensByAssumption = new Map<string, string>();
  for (const b of bundles) {
    store.upsertAssumption(b.assumption);
    lensByAssumption.set(b.assumption.id, b.coverageLens);
    for (const ev of b.evidence) store.upsertAssumptionEvidence(ev);
    for (const edge of b.edges) store.upsertGraphEdge(edge);
  }

  const buildOpts: BuildGraphOptions = {
    applicationSourceAvailable: true,
    semanticAnalyzer: 'react-scan',
    graphOrigin: 'application',
    applicationSummary: {
      reactFilesScanned: react.sourceFiles.length,
      assumptionsFromCode: bundles.length,
    },
  };

  const graph = assembleGraphView(store, [], buildOpts);
  const graphPath = path.join(config.surpryzeDir, 'graph.json');
  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));

  const lensPath = path.join(config.surpryzeDir, 'app-coverage-lenses.json');
  fs.writeFileSync(
    lensPath,
    JSON.stringify(
      Object.fromEntries(
        [...lensByAssumption.entries()].map(([id, lens]) => [id, { coverageLens: lens }]),
      ),
      null,
      2,
    ),
  );

  writeAssumptionGraphHtml(graph, config.surpryzeDir);
  writeAgentHandoff(config.surpryzeDir, config.projectRoot, graph);

  store.setMeta('lastScanAppAt', graph.generatedAt);
  store.setMeta('graphOrigin', 'application');
  store.setMeta('applicationRoot', appRoot);

  console.log(
    `Scanned ${react.sourceFiles.length} React files → ${bundles.length} application assumptions (${signals.length} code signals).`,
  );
  console.log(`Wrote ${graphPath}`);
  console.log('');
  console.log('Next: `surpryze match prepare` (UI test repo) → Claude skill → `surpryze match finalize`');
}
