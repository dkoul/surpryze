import type { Assumption } from '../knowledge/schemas.js';
import type { KnowledgeStore } from '../knowledge/store.js';
import { rankWeakness } from './confidence.js';

export function findWeakAssumptions(assumptions: Assumption[]): Assumption[] {
  return [...assumptions]
    .filter((a) => ['WEAK', 'UNTESTED', 'UNKNOWN'].includes(a.evidenceClass))
    .sort(
      (a, b) => rankWeakness(a.evidenceClass, a.confidence) - rankWeakness(b.evidenceClass, b.confidence),
    );
}

export function findWeakAssumptionsFromStore(store: KnowledgeStore): Assumption[] {
  return findWeakAssumptions(store.listAssumptions());
}
