import type { Assumption, AssumptionKind } from '../knowledge/schemas.js';

export function deriveAssumptionKind(assumption: Assumption): AssumptionKind {
  if (assumption.evidenceClass === 'UNKNOWN') return 'unknown';
  if (assumption.evidenceClass === 'STRONG' && assumption.source !== 'inferred') return 'supported';
  if (assumption.source === 'inferred' || assumption.source === 'documentation') return 'inferred';
  if (assumption.evidenceClass === 'WEAK' || assumption.evidenceClass === 'UNTESTED') return 'weak';
  if (assumption.claimPrecision === 'literal') return 'supported';
  return 'explicit';
}
