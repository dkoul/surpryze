import type { Surprise } from '../knowledge/schemas.js';
import type { KnowledgeStore } from '../knowledge/store.js';
import type { InvestigationClassificationSchema } from '../knowledge/schemas.js';
import { z } from 'zod';

export type InvestigationClassification = z.infer<typeof InvestigationClassificationSchema>;

export interface InvestigationBrief {
  surpriseId: string;
  summary: string;
  suggestedClassifications: InvestigationClassification[];
  evidencePointers: string[];
}

export function buildInvestigationBrief(store: KnowledgeStore, surpriseId: string): InvestigationBrief | null {
  const s = store.getSurprise(surpriseId);
  if (!s) return null;

  const obs = store.listObservations().find((o) => o.id === s.observationId);
  const exp = store.getExperiment(s.experimentId);

  const suggestions: InvestigationClassification[] = ['potential_defect'];
  if (s.observed.toLowerCase().includes('http 200')) {
    suggestions.push('known_undocumented', 'requirement_ambiguity');
  }

  return {
    surpriseId,
    summary: `Surprise during experiment "${exp?.hypothesis ?? s.experimentId}". Expected: ${s.expected}. Observed: ${s.observed}.`,
    suggestedClassifications: suggestions,
    evidencePointers: [
      `experiment:${s.experimentId}`,
      `observation:${s.observationId}`,
      ...(obs?.tracePath ? [`trace:${obs.tracePath}`] : []),
      ...s.evidence.map((e) => `${e.kind}:${e.id}`),
    ],
  };
}

export function classifySurprise(
  store: KnowledgeStore,
  surpriseId: string,
  classification: InvestigationClassification,
  humanNote?: string,
  decision?: 'ACCEPTED_DEFECT' | 'ACCEPTED_EXPECTED' | 'IGNORED' | 'EXPLAINED',
): void {
  const status = decision ?? (classification === 'potential_defect' ? 'ACCEPTED_DEFECT' : 'EXPLAINED');
  store.updateSurprise(surpriseId, {
    status,
    classification,
    humanNote,
  });

  const s = store.getSurprise(surpriseId);
  if (!s?.assumptionId) return;
  const a = store.getAssumption(s.assumptionId);
  if (!a) return;
  const now = new Date().toISOString();
  let newStatus = a.status;
  if (status === 'ACCEPTED_DEFECT' || status === 'ACCEPTED_EXPECTED') {
    newStatus = status === 'ACCEPTED_DEFECT' ? 'CONTRADICTED' : 'CONFIRMED';
  }
  if (status === 'EXPLAINED') newStatus = 'CHALLENGED';
  store.upsertAssumption({ ...a, status: newStatus, updatedAt: now });
}
