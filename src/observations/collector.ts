import fs from 'node:fs';
import { createHash } from 'node:crypto';
import type { Experiment, Observation, ResultState } from '../knowledge/schemas.js';
import type { KnowledgeStore } from '../knowledge/store.js';

function obsId(experimentId: string): string {
  return 'O-' + createHash('sha256').update(experimentId + Date.now()).digest('hex').slice(0, 8);
}

export interface RawObservationBatch {
  observations: Array<{
    experimentId: string;
    [key: string]: unknown;
  }>;
}

export function loadObservationBatch(filePath: string): RawObservationBatch {
  if (!fs.existsSync(filePath)) {
    return { observations: [] };
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as RawObservationBatch;
}

export function persistObservations(
  store: KnowledgeStore,
  batch: RawObservationBatch,
  resultByExperiment: Map<string, ResultState>,
): Observation[] {
  const saved: Observation[] = [];
  const now = new Date().toISOString();

  for (const raw of batch.observations) {
    const experimentId = raw.experimentId as string;
    const result = resultByExperiment.get(experimentId) ?? 'UNKNOWN';
    const o: Observation = {
      id: obsId(experimentId),
      experimentId,
      result,
      payload: raw,
      createdAt: now,
    };
    store.insertObservation(o);
    saved.push(o);
  }

  return saved;
}

export function mergeObservationFiles(paths: string[]): RawObservationBatch {
  const merged: RawObservationBatch = { observations: [] };
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    const b = loadObservationBatch(p);
    merged.observations.push(...b.observations);
  }
  return merged;
}

export function experimentObservationFromStore(
  store: KnowledgeStore,
  experiment: Experiment,
): Observation | undefined {
  return store.listObservations().find((o) => o.experimentId === experiment.id);
}
