import { createHash } from 'node:crypto';
import type { Assumption, ParsedTest } from '../knowledge/schemas.js';
import { getDefaultLlmProvider } from '../llm/provider.js';
import type { KnowledgeStore } from '../knowledge/store.js';

function assumptionId(statement: string): string {
  return 'A-' + createHash('sha256').update(statement).digest('hex').slice(0, 6);
}

export async function extractAndStoreAssumptions(
  store: KnowledgeStore,
  tests: ParsedTest[],
): Promise<Assumption[]> {
  const llm = getDefaultLlmProvider();
  const proposals = await llm.proposeAssumptions(tests);
  const now = new Date().toISOString();
  const assumptions: Assumption[] = [];

  for (const p of proposals) {
    const linkedTests = tests.filter((t) =>
      p.rationale.includes(t.id) || (p.feature && t.feature === p.feature),
    );
    const status =
      linkedTests.length > 0 && p.statement.toLowerCase().includes('only the latest')
        ? 'UNTESTED'
        : linkedTests.length > 0
          ? 'TESTED'
          : 'UNTESTED';

    const a: Assumption = {
      id: assumptionId(p.statement),
      statement: p.statement,
      feature: p.feature,
      source: p.source,
      confidence: p.confidence,
      status,
      provenance: [
        { kind: 'inference', id: llm.name, label: p.rationale },
        ...linkedTests.map((t) => ({ kind: 'test', id: t.id, label: t.title })),
      ],
      createdAt: now,
      updatedAt: now,
    };
    store.upsertAssumption(a);
    assumptions.push(a);
  }

  return assumptions;
}

export function findWeakAssumptions(assumptions: Assumption[]): Assumption[] {
  return assumptions.filter(
    (a) =>
      a.status === 'UNTESTED' ||
      (a.confidence >= 0.6 && a.status !== 'CHALLENGED' && a.status !== 'CONFIRMED'),
  );
}
