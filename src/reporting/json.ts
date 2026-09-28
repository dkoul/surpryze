import fs from 'node:fs';
import path from 'node:path';
import type { KnowledgeStore } from '../knowledge/store.js';
import { computeMetrics } from './metrics.js';

export function writeJsonReport(store: KnowledgeStore, surpryzeDir: string): string {
  const out = path.join(surpryzeDir, 'report.json');
  const graphPath = store.getMeta('assumptionGraphPath');
  const payload = {
    generatedAt: new Date().toISOString(),
    metrics: computeMetrics(store),
    assumptionGraph: graphPath ?? null,
    tests: store.listTests(),
    assumptions: store.listAssumptions(),
    graphEdges: store.listGraphEdges(),
    assumptionEvidence: store.listAssumptionEvidence(),
    experiments: store.listExperiments(),
    observations: store.listObservations(),
    surprises: store.listSurprises(),
  };
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  return out;
}
