import { createHash } from 'node:crypto';
import type {
  Assumption,
  AssumptionEvidence,
  GraphEdge,
} from '../knowledge/schemas.js';
import type { CoverageLens } from '../heuristics/coverage-lenses.js';
import type { AppAssumptionCandidate } from './scan.js';
import { appAssumptionId } from './scan.js';
import { classifyEvidence, deriveConfidenceFromEvidence } from '../assumptions/confidence.js';

function evidenceId(assumptionId: string, refId: string): string {
  return (
    'EV-' +
    createHash('sha256').update(`${assumptionId}|${refId}|supports`).digest('hex').slice(0, 8)
  );
}

function edgeId(from: string, to: string, relation: string): string {
  return 'GE-' + createHash('sha256').update(`${from}|${to}|${relation}`).digest('hex').slice(0, 8);
}

export interface AppGraphBundle {
  assumption: Assumption;
  evidence: AssumptionEvidence[];
  edges: GraphEdge[];
  coverageLens: CoverageLens;
}

export function bundlesFromAppCandidates(candidates: AppAssumptionCandidate[]): AppGraphBundle[] {
  const now = new Date().toISOString();
  const bundles: AppGraphBundle[] = [];

  for (const c of candidates) {
    const id = appAssumptionId(c.statement);
    const evidence: AssumptionEvidence[] = [];
    const edges: GraphEdge[] = [];

    for (const sig of c.signals) {
      evidence.push({
        id: evidenceId(id, sig.id),
        assumptionId: id,
        refKind: 'code',
        refId: sig.id,
        refLabel: `${sig.kind}: ${sig.label} (${sig.filePath}${sig.line ? `:${sig.line}` : ''})`,
        evidenceKind: 'direct',
        polarity: 'supports',
        weight: 0.55,
      });
      edges.push({
        id: edgeId(id, sig.id, 'derived_from'),
        fromKind: 'assumption',
        fromId: id,
        toKind: 'assumption',
        toId: sig.id,
        relation: 'derived_from',
        evidenceKind: 'direct',
        metadata: { codeSignal: sig.id, coverageLens: c.lens },
      });
    }

    const confidence = deriveConfidenceFromEvidence(evidence);
    const evidenceClass = classifyEvidence(evidence, false, 'structural');

    const assumption: Assumption = {
      id,
      statement: c.statement,
      statementHash: createHash('sha256').update(c.statement).digest('hex'),
      feature: c.feature,
      source: 'application',
      confidence,
      evidenceClass,
      claimPrecision: 'structural',
      expectedLiterals: [],
      status: 'UNTESTED',
      provenance: c.signals.map((s) => ({
        kind: 'code',
        id: s.id,
        label: s.label,
      })),
      missingScenarios: [],
      createdAt: now,
      updatedAt: now,
    };

    bundles.push({ assumption, evidence, edges, coverageLens: c.lens });
  }

  return bundles;
}
