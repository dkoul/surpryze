import { createHash } from 'node:crypto';
import type {
  Assumption,
  AssumptionEvidence,
  GraphEdge,
  ParsedTest,
} from '../knowledge/schemas.js';
import { classifyEvidence, deriveConfidenceFromEvidence } from './confidence.js';

export interface MinedAssumptionBundle {
  assumption: Assumption;
  evidence: AssumptionEvidence[];
  edges: GraphEdge[];
  parentAssumptionIds: string[];
}

export interface MineResult {
  bundles: MinedAssumptionBundle[];
}

function stableAssumptionId(statement: string): string {
  const normalized = statement.trim().toLowerCase().replace(/\s+/g, ' ');
  return 'A-' + createHash('sha256').update(normalized).digest('hex').slice(0, 8);
}

function statementHash(statement: string): string {
  return createHash('sha256').update(statement.trim().toLowerCase()).digest('hex');
}

function evidenceId(assumptionId: string, refId: string, polarity: string): string {
  return (
    'EV-' +
    createHash('sha256').update(`${assumptionId}|${refId}|${polarity}`).digest('hex').slice(0, 8)
  );
}

function edgeId(from: string, to: string, relation: string): string {
  return (
    'GE-' + createHash('sha256').update(`${from}|${to}|${relation}`).digest('hex').slice(0, 8)
  );
}

interface Candidate {
  statement: string;
  feature?: string;
  source: Assumption['source'];
  testId?: string;
  assertionId?: string;
  assertionExpr?: string;
  evidenceKind: AssumptionEvidence['evidenceKind'];
  linkKind: 'explicit' | 'implicit';
}

const GAP_ASSUMPTIONS: Array<{
  statement: string;
  feature: string;
  missingScenarios: string[];
  parentStatements: string[];
  detectUntested: (tests: ParsedTest[]) => boolean;
}> = [
  {
    statement: 'Only the latest password reset token is valid for a user',
    feature: 'password_reset',
    missingScenarios: [
      'User requests reset twice and submits the older token',
      'Concurrent reset requests from multiple clients',
    ],
    parentStatements: ['A valid reset token allows setting a new password'],
    detectUntested: (tests) =>
      tests.some((t) => t.feature === 'password_reset') &&
      !tests.some((t) => {
        const tl = t.title.toLowerCase();
        return tl.includes('multiple') || tl.includes('second request') || tl.includes('latest token');
      }),
  },
];

const CONFLICTING_STATEMENT_PAIRS: [string, string][] = [
  [
    'Deleted accounts cannot request password reset',
    'Password reset can be requested for any registered email',
  ],
];

function titleToCandidates(test: ParsedTest): Candidate[] {
  const out: Candidate[] = [];
  const tl = test.title.toLowerCase();

  const rules: Array<{ match: RegExp | ((t: string) => boolean); statement: string }> = [
    { match: /expired/, statement: 'Reset links expire after the configured time window' },
    { match: /invalid|rejected/, statement: 'Invalid or expired reset tokens are rejected' },
    { match: /deleted/, statement: 'Deleted accounts cannot request password reset' },
    { match: /success|complete/, statement: 'A valid reset token allows setting a new password' },
    { match: /variant|reset flow/, statement: 'Password reset can be requested for any registered email' },
    { match: /weak|policy|number/, statement: 'New passwords must satisfy the password policy' },
    { match: /reuse|cannot be reused/, statement: 'A reset token cannot be used more than once' },
    { match: /unknown user|not found/, statement: 'Password reset is not offered for unknown emails' },
    { match: /health|home page/, statement: 'The application exposes basic availability endpoints and UI' },
  ];

  for (const rule of rules) {
    const ok = typeof rule.match === 'function' ? rule.match(tl) : rule.match.test(tl);
    if (!ok) continue;
    out.push({
      statement: rule.statement,
      feature: test.feature,
      source: 'test',
      testId: test.id,
      evidenceKind: 'direct',
      linkKind: 'implicit',
    });
  }

  for (const a of test.assertionDetails ?? []) {
    out.push({
      statement: assertionToBelief(a.expression, test),
      feature: test.feature,
      source: 'test',
      testId: test.id,
      assertionId: a.id,
      assertionExpr: a.expression,
      evidenceKind: 'direct',
      linkKind: 'explicit',
    });
  }

  for (const expr of test.assertions) {
    if (test.assertionDetails?.some((d) => d.expression === expr)) continue;
    out.push({
      statement: assertionToBelief(expr, test),
      feature: test.feature,
      source: 'test',
      testId: test.id,
      evidenceKind: 'direct',
      linkKind: 'explicit',
    });
  }

  return out;
}

function assertionToBelief(expr: string, test: ParsedTest): string {
  if (expr.includes('toBeGreaterThanOrEqual') && test.title.toLowerCase().includes('deleted')) {
    return 'Deleted accounts cannot request password reset';
  }
  if (expr.includes('toBe(400)') || expr.includes('toBeGreaterThanOrEqual(400)')) {
    return 'Invalid or rejected operations return HTTP 4xx';
  }
  if (expr.includes('.ok()')) {
    if (test.title.toLowerCase().includes('reset-request') || test.apiCalls.length > 0) {
      return 'Password reset request succeeds for eligible users';
    }
    return `Operation succeeds: ${test.title}`;
  }
  if (expr.includes('toContainText')) {
    return `UI displays expected content (${expr})`;
  }
  return `Assertion holds: ${expr}`;
}

export function mineAssumptionGraph(tests: ParsedTest[]): MineResult {
  const now = new Date().toISOString();
  const testById = new Map(tests.map((t) => [t.id, t]));
  const byStatement = new Map<string, Candidate[]>();

  for (const test of tests) {
    for (const c of titleToCandidates(test)) {
      const key = c.statement.trim().toLowerCase();
      const list = byStatement.get(key) ?? [];
      list.push(c);
      byStatement.set(key, list);
    }
  }

  // Gap / untested assumptions
  for (const gap of GAP_ASSUMPTIONS) {
    if (!gap.detectUntested(tests)) continue;
    const key = gap.statement.trim().toLowerCase();
    byStatement.set(key, [
      {
        statement: gap.statement,
        feature: gap.feature,
        source: 'inferred',
        evidenceKind: 'missing',
        linkKind: 'implicit',
      },
    ]);
  }

  const bundles: MinedAssumptionBundle[] = [];
  const statementToId = new Map<string, string>();

  for (const [key, candidates] of byStatement) {
    const statement = candidates[0].statement;
    const id = stableAssumptionId(statement);
    statementToId.set(key, id);
    const evidence: AssumptionEvidence[] = [];
    const edges: GraphEdge[] = [];

    const seenEvidence = new Set<string>();
    for (const c of candidates) {
      if (c.testId) {
        const refId = c.assertionId ?? c.testId;
        const refKind = c.assertionId ? 'assertion' : 'test';
        const dedupeKey = `${refKind}:${refId}:supports`;
        if (seenEvidence.has(dedupeKey)) continue;
        seenEvidence.add(dedupeKey);
        const testTitle = testById.get(c.testId)?.title;
        evidence.push({
          id: evidenceId(id, refId, 'supports'),
          assumptionId: id,
          refKind,
          refId,
          refLabel: c.assertionExpr ?? testTitle ?? c.testId,
          evidenceKind: c.evidenceKind,
          polarity: 'supports',
          weight: c.evidenceKind === 'direct' ? 0.38 : c.evidenceKind === 'indirect' ? 0.18 : 0,
        });
        edges.push({
          id: edgeId(c.testId, id, 'supports'),
          fromKind: refKind === 'assertion' ? 'assertion' : 'test',
          fromId: refId,
          toKind: 'assumption',
          toId: id,
          relation: c.linkKind === 'explicit' ? 'evidence_for' : 'supports',
          evidenceKind: c.evidenceKind,
        });
      } else if (c.evidenceKind === 'missing') {
        evidence.push({
          id: evidenceId(id, 'gap', 'missing'),
          assumptionId: id,
          refKind: 'code',
          refId: 'suite-gap',
          refLabel: 'No test challenges this behavior',
          evidenceKind: 'missing',
          polarity: 'supports',
          weight: 0,
        });
      }
    }

    const contradictions = findContradictions(statement, candidates, tests, id);
    evidence.push(...contradictions);

    const confidence = deriveConfidenceFromEvidence(evidence);
    const evidenceClass = classifyEvidence(evidence, contradictions.length > 0);
    const hasDirectTest = evidence.some((e) => e.evidenceKind === 'direct' && e.refKind === 'test');
    const status =
      evidenceClass === 'UNTESTED' ? 'UNTESTED' : hasDirectTest ? 'TESTED' : 'UNTESTED';

    const gapMeta = GAP_ASSUMPTIONS.find((g) => g.statement === statement);

    const assumption: Assumption = {
      id,
      statement,
      statementHash: statementHash(statement),
      feature: candidates[0].feature,
      source: candidates.some((c) => c.source === 'test') ? 'test' : 'inferred',
      confidence,
      evidenceClass,
      status,
      provenance: evidence
        .filter((e) => e.polarity === 'supports' && e.evidenceKind !== 'missing')
        .map((e) => ({
          kind: e.refKind,
          id: e.refId,
          label: e.refLabel,
        })),
      missingScenarios: gapMeta?.missingScenarios ?? [],
      createdAt: now,
      updatedAt: now,
    };

    const parentAssumptionIds =
      gapMeta?.parentStatements.map((s) => stableAssumptionId(s)).filter((pid) => pid !== id) ?? [];

    for (const pid of parentAssumptionIds) {
      edges.push({
        id: edgeId(id, pid, 'child_of'),
        fromKind: 'assumption',
        fromId: id,
        toKind: 'assumption',
        toId: pid,
        relation: 'child_of',
        evidenceKind: 'inferred',
      });
    }

    bundles.push({ assumption, evidence, edges, parentAssumptionIds });
  }

  // Cross-assumption contradiction edges
  for (const [aStmt, bStmt] of CONFLICTING_STATEMENT_PAIRS) {
    const aId = stableAssumptionId(aStmt);
    const bId = stableAssumptionId(bStmt);
    const aBundle = bundles.find((b) => b.assumption.id === aId);
    const bBundle = bundles.find((b) => b.assumption.id === bId);
    if (!aBundle || !bBundle) continue;
    aBundle.edges.push({
      id: edgeId(aId, bId, 'contradicts'),
      fromKind: 'assumption',
      fromId: aId,
      toKind: 'assumption',
      toId: bId,
      relation: 'contradicts',
      evidenceKind: 'inferred',
    });
    bBundle.assumption.evidenceClass = 'WEAK';
    aBundle.assumption.evidenceClass = 'WEAK';
  }

  return { bundles };
}

function findContradictions(
  statement: string,
  _candidates: Candidate[],
  tests: ParsedTest[],
  assumptionId: string,
): AssumptionEvidence[] {
  const out: AssumptionEvidence[] = [];
  if (statement.includes('Deleted accounts cannot')) {
    const deletedTest = tests.find((t) => t.title.toLowerCase().includes('deleted'));
    const successTests = tests.filter(
      (t) => t.title.toLowerCase().includes('variant') && t.assertions.some((a) => a.includes('.ok()')),
    );
    if (deletedTest && successTests.length > 0) {
      // Not a contradiction — different scenarios; only flag if same API action conflicting
    }
  }
  for (const [a, b] of CONFLICTING_STATEMENT_PAIRS) {
    if (statement === a) {
      out.push({
        id: evidenceId(assumptionId, stableAssumptionId(b), 'contradicts'),
        assumptionId,
        refKind: 'assumption',
        refId: stableAssumptionId(b),
        refLabel: b,
        evidenceKind: 'inferred',
        polarity: 'contradicts',
        weight: 0,
      });
    }
  }
  return out;
}
