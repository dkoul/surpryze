import type { Assumption } from '../knowledge/schemas.js';
import type { KnowledgeStore } from '../knowledge/store.js';
import { rankWeakness } from './confidence.js';

export function findWeakAssumptions(assumptions: Assumption[]): Assumption[] {
  return [...assumptions]
    .filter((a) => ['WEAK', 'UNTESTED', 'UNKNOWN'].includes(a.evidenceClass))
    .sort(
      (a, b) =>
        rankWeakness(a.evidenceClass, a.confidence, a.claimPrecision) -
        rankWeakness(b.evidenceClass, b.confidence, b.claimPrecision),
    );
}

export function findWeakAssumptionsFromStore(store: KnowledgeStore): Assumption[] {
  return findWeakAssumptions(store.listAssumptions());
}
