import { createHash } from 'node:crypto';
import type { Assumption, Experiment } from '../knowledge/schemas.js';

function experimentId(hypothesis: string): string {
  return 'E-' + createHash('sha256').update(hypothesis).digest('hex').slice(0, 6);
}

export interface PlannedExperiment extends Experiment {
  template: 'multiple_reset_tokens' | 'deleted_account_reset' | 'generic_sequence';
}

export function planExperiments(assumptions: Assumption[], budget: number): PlannedExperiment[] {
  const weak = assumptions.filter(
    (a) =>
      a.evidenceClass === 'UNTESTED' ||
      a.evidenceClass === 'WEAK' ||
      a.evidenceClass === 'UNKNOWN' ||
      a.status === 'UNTESTED',
  );
  const planned: PlannedExperiment[] = [];
  const now = new Date().toISOString();

  for (const a of weak) {
    if (planned.length >= budget) break;
    const stmt = a.statement.toLowerCase();

    if (stmt.includes('latest') && stmt.includes('token')) {
      planned.push({
        id: experimentId('multiple reset tokens'),
        hypothesis: 'Only the latest reset token is valid',
        strategy: 'contradiction',
        assumptionIds: [a.id],
        steps: [
          'request_reset',
          'capture_token_A',
          'request_reset',
          'capture_token_B',
          'use_token_A',
          'use_token_B',
        ],
        expected: {
          token_A: 'rejected',
          token_B: 'accepted',
        },
        template: 'multiple_reset_tokens',
        createdAt: now,
      });
      continue;
    }

    if (stmt.includes('deleted') && stmt.includes('cannot')) {
      planned.push({
        id: experimentId('deleted account reset'),
        hypothesis: 'Deleted accounts cannot request password reset',
        strategy: 'boundary',
        assumptionIds: [a.id],
        steps: ['create_user', 'delete_user', 'request_reset_deleted'],
        expected: {
          httpStatus: '403_or_404',
          emailSent: 'false',
        },
        template: 'deleted_account_reset',
        createdAt: now,
      });
      continue;
    }
  }

  if (planned.length < budget) {
    for (const a of weak) {
      if (planned.length >= budget) break;
      if (planned.some((p) => p.assumptionIds.includes(a.id))) continue;
      planned.push({
        id: experimentId(a.statement + '-sequence'),
        hypothesis: `Challenge assumption: ${a.statement}`,
        strategy: 'sequence',
        assumptionIds: [a.id],
        steps: ['replay_related_workflow', 'observe_side_effects'],
        expected: undefined,
        template: 'generic_sequence',
        createdAt: now,
      });
    }
  }

  return planned.slice(0, budget);
}
