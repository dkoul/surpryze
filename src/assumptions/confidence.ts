import type {
  AssumptionEvidence,
  EvidenceClass,
  EvidenceKind,
} from '../knowledge/schemas.js';

const KIND_WEIGHT: Record<EvidenceKind, number> = {
  direct: 0.38,
  indirect: 0.18,
  inferred: 0.1,
  missing: 0,
};

export function deriveConfidenceFromEvidence(evidence: AssumptionEvidence[]): number {
  const supporting = evidence.filter((e) => e.polarity === 'supports');
  let score = 0;
  const kindsSeen = new Set<EvidenceKind>();
  for (const e of supporting) {
    if (e.evidenceKind === 'missing') continue;
    kindsSeen.add(e.evidenceKind);
    score += e.weight > 0 ? e.weight : KIND_WEIGHT[e.evidenceKind];
  }
  // Diminishing returns for many indirect/inferred pieces
  if (kindsSeen.has('direct')) {
    score = Math.min(1, score);
  } else {
    score = Math.min(0.72, score);
  }
  return Math.round(score * 1000) / 1000;
}

export function classifyEvidence(
  evidence: AssumptionEvidence[],
  hasContradictions: boolean,
): EvidenceClass {
  const supporting = evidence.filter((e) => e.polarity === 'supports' && e.evidenceKind !== 'missing');
  const missingMarkers = evidence.filter((e) => e.evidenceKind === 'missing');

  if (supporting.length === 0 && missingMarkers.length > 0) return 'UNTESTED';
  if (supporting.length === 0) return 'UNKNOWN';

  const hasDirect = supporting.some((e) => e.evidenceKind === 'direct');
  const hasIndirect = supporting.some((e) => e.evidenceKind === 'indirect');

  if (hasContradictions) return 'WEAK';
  if (hasDirect && !hasContradictions) return 'STRONG';
  if (hasIndirect || supporting.some((e) => e.evidenceKind === 'inferred')) return 'WEAK';
  return 'WEAK';
}

export function rankWeakness(
  evidenceClass: EvidenceClass,
  confidence: number,
): number {
  const classRank: Record<EvidenceClass, number> = {
    UNKNOWN: 0,
    UNTESTED: 1,
    WEAK: 2,
    STRONG: 3,
  };
  return classRank[evidenceClass] * 1000 + confidence;
}
