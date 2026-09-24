import path from 'node:path';
import { openDatabase } from '../knowledge/db.js';
import { KnowledgeStore } from '../knowledge/store.js';
import type { SurpryzeConfig } from '../knowledge/schemas.js';
import { runExplore } from '../experiments/executor.js';
import { loadObservationBatch, persistObservations } from '../observations/collector.js';
import { detectSurprises } from '../surprise/detector.js';
import { persistMetrics } from '../reporting/metrics.js';

export async function runExplorePipeline(
  config: SurpryzeConfig,
  budget: number,
  baseUrl?: string,
): Promise<void> {
  const db = openDatabase(config.surpryzeDir);
  const store = new KnowledgeStore(db);

  const { experiments, observationFile } = await runExplore(config, store, budget, baseUrl);
  const batch = loadObservationBatch(observationFile);

  const resultMap = new Map<string, 'PASS' | 'UNKNOWN' | 'SURPRISE'>();
  for (const raw of batch.observations) {
    resultMap.set(raw.experimentId as string, 'UNKNOWN');
  }

  const observations = persistObservations(store, batch, resultMap);
  const surprises = detectSurprises(store, experiments, observations);

  for (const o of observations) {
    if (surprises.some((s) => s.observationId === o.id)) {
      o.result = 'SURPRISE';
    } else if (o.result === 'UNKNOWN') {
      o.result = 'PASS';
    }
  }

  persistMetrics(store);
  store.setMeta('lastExploreAt', new Date().toISOString());

  console.log(
    `Explore complete: ${experiments.length} experiments, ${observations.length} observations, ${surprises.length} surprises.`,
  );
  if (surprises.length > 0) {
    for (const s of surprises) {
      console.log(`  ${s.id}: ${s.observed}`);
    }
  }
}
