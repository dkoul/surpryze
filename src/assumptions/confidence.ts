import type {
  AssumptionEvidence,
  ClaimPrecision,
  EvidenceClass,
  EvidenceKind,
} from '../knowledge/schemas.js';

export function deriveConfidenceFromEvidence(evidence: AssumptionEvidence[]): number {
  const supporting = evidence.filter((e) => e.polarity === 'supports' && e.evidenceKind !== 'missing');
  if (supporting.length === 0) return 0;
  let score = 0;
  for (const e of supporting) {
    score += e.weight > 0 ? e.weight : 0.1;
  }
  // Multiple independent evidences add modestly, cap below 1
  const bonus = Math.min(0.15, (supporting.length - 1) * 0.05);
  return Math.round(Math.min(1, score + bonus) * 1000) / 1000;
}

export function classifyEvidence(
  evidence: AssumptionEvidence[],
  hasContradictions: boolean,
  claimPrecision: ClaimPrecision,
): EvidenceClass {
  const supporting = evidence.filter((e) => e.polarity === 'supports' && e.evidenceKind !== 'missing');
  const missingMarkers = evidence.filter((e) => e.evidenceKind === 'missing');

  if (supporting.length === 0 && missingMarkers.length > 0) return 'UNTESTED';
  if (supporting.length === 0) return 'UNKNOWN';
  if (hasContradictions) return 'WEAK';

  // STRONG = literal behavioral oracle with extractable expected values
  if (claimPrecision === 'literal') return 'STRONG';
  return 'WEAK';
}

export function rankWeakness(
  evidenceClass: EvidenceClass,
  confidence: number,
  claimPrecision: ClaimPrecision,
): number {
  const classRank: Record<EvidenceClass, number> = {
    UNKNOWN: 0,
    UNTESTED: 1,
    WEAK: 2,
    STRONG: 3,
  };
  const precisionRank: Record<ClaimPrecision, number> = {
    intent: 0,
    structural: 1,
    literal: 2,
  };
  return classRank[evidenceClass] * 1000 + precisionRank[claimPrecision] * 100 + confidence;
}

export function aggregateClaimPrecision(parts: ClaimPrecision[]): ClaimPrecision {
  if (parts.includes('literal')) return 'literal';
  if (parts.includes('structural')) return 'structural';
  return 'intent';
}
