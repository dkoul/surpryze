import { createHash } from 'node:crypto';
import type {
  Assumption,
  Experiment,
  Observation,
  Surprise,
} from '../knowledge/schemas.js';
import type { KnowledgeStore } from '../knowledge/store.js';

function surpriseId(parts: string[]): string {
  return 'SURPRISE-' + createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 6);
}

export function detectSurprises(
  store: KnowledgeStore,
  experiments: Experiment[],
  observations: Observation[],
): Surprise[] {
  const assumptions = store.listAssumptions();
  const surprises: Surprise[] = [];
  const now = new Date().toISOString();

  for (const obs of observations) {
    const exp = experiments.find((e) => e.id === obs.experimentId);
    if (!exp) continue;

    const detected = applyDeterministicRules(exp, obs, assumptions);
    for (const d of detected) {
      const s: Surprise = {
        id: surpriseId([exp.id, d.expected, d.observed]),
        feature: d.feature,
        expected: d.expected,
        observed: d.observed,
        assumptionId: d.assumptionId,
        experimentId: exp.id,
        observationId: obs.id,
        evidence: [
          { kind: 'experiment', id: exp.id, label: exp.hypothesis },
          { kind: 'observation', id: obs.id },
          ...(d.assumptionId ? [{ kind: 'assumption', id: d.assumptionId }] : []),
        ],
        impact: d.impact,
        confidence: d.confidence,
        status: 'OPEN',
        createdAt: now,
      };
      store.insertSurprise(s);
      surprises.push(s);

      if (d.assumptionId) {
        const a = store.getAssumption(d.assumptionId);
        if (a) {
          store.upsertAssumption({
            ...a,
            status: 'CONTRADICTED',
            evidenceClass: 'WEAK',
            claimPrecision: a.claimPrecision,
            expectedLiterals: a.expectedLiterals,
            updatedAt: now,
          });
        }
      }
    }
  }

  return surprises;
}

interface RuleHit {
  expected: string;
  observed: string;
  assumptionId?: string;
  feature?: string;
  impact?: string;
  confidence: number;
}

function applyDeterministicRules(
  exp: Experiment,
  obs: Observation,
  assumptions: Assumption[],
): RuleHit[] {
  const hits: RuleHit[] = [];
  const payload = obs.payload;

  if (exp.expected?.token_A === 'rejected' && payload.tokenA) {
    const tokenA = payload.tokenA as { status: number; body: unknown };
    const tokenB = payload.tokenB as { status: number; body: unknown };
    const aRejected = tokenA.status >= 400;
    const bAccepted = tokenB.status >= 200 && tokenB.status < 300;
    if (!aRejected && bAccepted) {
      const assumption = assumptions.find((a) =>
        exp.assumptionIds.includes(a.id) ||
        a.statement.toLowerCase().includes('latest'),
      );
      hits.push({
        expected: 'First (older) reset token should be rejected when a newer token exists',
        observed: `token_A HTTP ${tokenA.status} (accepted); token_B HTTP ${tokenB.status}`,
        assumptionId: assumption?.id,
        feature: 'password_reset',
        impact: 'Security',
        confidence: 0.91,
      });
    }
  }

  if (exp.expected?.emailSent === 'false' || exp.steps.includes('request_reset_deleted')) {
    const httpStatus = payload.httpStatus as number | undefined;
    const body = payload.body as { emailSent?: boolean; error?: string } | undefined;
    if (httpStatus === 200 && body?.emailSent) {
      const assumption = assumptions.find((a) => exp.assumptionIds.includes(a.id));
      hits.push({
        expected: 'Deleted accounts cannot request password reset (no email sent)',
        observed: `HTTP ${httpStatus}, reset email generated`,
        assumptionId: assumption?.id,
        feature: 'password_reset',
        impact: 'Security',
        confidence: 0.91,
      });
    }
  }

  return hits;
}
