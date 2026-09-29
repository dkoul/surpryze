import fs from 'node:fs';
import path from 'node:path';
import type { AssumptionGraph } from './schemas.js';
import type { KnowledgeStore } from './store.js';

export interface ConfidenceRunSnapshot {
  runAt: string;
  byAssumption: Record<string, number>;
}

export function loadPreviousSnapshot(surpryzeDir: string): ConfidenceRunSnapshot | null {
  const p = path.join(surpryzeDir, 'confidence-runs.json');
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8')) as {
      runs?: ConfidenceRunSnapshot[];
    };
    const runs = data.runs ?? [];
    return runs.length > 0 ? runs[runs.length - 1] : null;
  } catch {
    return null;
  }
}

export function recordConfidenceRun(store: KnowledgeStore, graph: AssumptionGraph): void {
  const surpryzeDir = store.surpryzeDir;
  const p = path.join(surpryzeDir, 'confidence-runs.json');
  let runs: ConfidenceRunSnapshot[] = [];
  if (fs.existsSync(p)) {
    try {
      runs = (JSON.parse(fs.readFileSync(p, 'utf8')) as { runs: ConfidenceRunSnapshot[] }).runs ?? [];
    } catch {
      runs = [];
    }
  }
  const snapshot: ConfidenceRunSnapshot = {
    runAt: graph.generatedAt,
    byAssumption: Object.fromEntries(
      graph.assumptions.map((v) => [v.assumption.id, v.assumption.confidence]),
    ),
  };
  runs.push(snapshot);
  if (runs.length > 20) runs = runs.slice(-20);
  fs.writeFileSync(p, JSON.stringify({ runs }, null, 2));
  store.setMeta('lastConfidenceRunAt', snapshot.runAt);
}

export interface ConfidenceDelta {
  assumptionId: string;
  statement: string;
  previous: number | null;
  current: number;
  delta: number | null;
}

export function computeConfidenceDeltas(
  graph: AssumptionGraph,
  previous: ConfidenceRunSnapshot | null,
): ConfidenceDelta[] {
  if (!previous) return [];
  const deltas: ConfidenceDelta[] = [];
  for (const v of graph.assumptions) {
    const prev = previous.byAssumption[v.assumption.id];
    if (prev === undefined) continue;
    const delta = v.assumption.confidence - prev;
    if (Math.abs(delta) < 0.001) continue;
    deltas.push({
      assumptionId: v.assumption.id,
      statement: v.assumption.statement,
      previous: prev,
      current: v.assumption.confidence,
      delta,
    });
  }
  deltas.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));
  return deltas;
}
