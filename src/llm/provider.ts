import type { Assumption, ParsedTest } from '../knowledge/schemas.js';

export interface LlmAssumptionProposal {
  statement: string;
  feature?: string;
  confidence: number;
  source: Assumption['source'];
  rationale: string;
}

export interface LlmProvider {
  name: string;
  proposeAssumptions(tests: ParsedTest[], context?: string): Promise<LlmAssumptionProposal[]>;
}

/** Deterministic heuristic provider for MVP — no external API required. */
export class HeuristicLlmProvider implements LlmProvider {
  name = 'heuristic';

  async proposeAssumptions(tests: ParsedTest[]): Promise<LlmAssumptionProposal[]> {
    const proposals: LlmAssumptionProposal[] = [];
    const seen = new Set<string>();

    for (const t of tests) {
      const titleLower = t.title.toLowerCase();
      const candidates: string[] = [];

      if (titleLower.includes('expired')) {
        candidates.push('Reset links expire after the configured time window');
      }
      if (titleLower.includes('invalid') || titleLower.includes('rejected')) {
        candidates.push('Invalid or expired reset tokens are rejected');
      }
      if (titleLower.includes('deleted')) {
        candidates.push('Deleted accounts cannot request password reset');
      }
      if (titleLower.includes('success') || titleLower.includes('complete')) {
        candidates.push('A valid reset token allows setting a new password');
      }
      if (titleLower.includes('policy') || titleLower.includes('weak')) {
        candidates.push('New passwords must satisfy the password policy');
      }
      for (const a of t.assertions) {
        if (a.includes('toBeVisible') || a.includes('toContainText')) {
          candidates.push(`UI shows expected outcome for: ${t.title}`);
        }
      }

      for (const c of candidates) {
        const key = c.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        proposals.push({
          statement: c,
          feature: t.feature,
          confidence: titleLower.includes('deleted') ? 0.85 : 0.72,
          source: 'inferred',
          rationale: `Inferred from test ${t.id}: ${t.title}`,
        });
      }
    }

    if (!seen.has('only the latest reset token is valid')) {
      const resetTests = tests.filter((t) => t.feature === 'password_reset');
      const challengesMulti = resetTests.some((t) =>
        t.title.toLowerCase().includes('multiple') || t.title.toLowerCase().includes('second request'),
      );
      if (resetTests.length > 0 && !challengesMulti) {
        proposals.push({
          statement: 'Only the latest password reset token is valid for a user',
          feature: 'password_reset',
          confidence: 0.64,
          source: 'inferred',
          rationale:
            'Suite exercises password reset but no test challenges multiple concurrent reset requests',
        });
      }
    }

    return proposals;
  }
}

export function getDefaultLlmProvider(): LlmProvider {
  return new HeuristicLlmProvider();
}
