import { createHash } from 'node:crypto';
import type { Assumption, AssumptionGraph, ParsedTest } from '../knowledge/schemas.js';
import { rankWeakness } from '../assumptions/confidence.js';
import {
  buildSfdotCoverage,
  SFDOT_LABELS,
  sfdotGapSuggestions,
  sfdotGapId,
  type SfdotDimension,
} from './sfdot.js';

export type GapCategory =
  | 'untested_assumption'
  | 'missing_evidence'
  | 'contradiction'
  | 'weak_oracles'
  | 'no_assertions'
  | 'intent_only_oracle'
  | 'structural_only_oracle'
  | 'negative_path'
  | 'analysis_limit'
  | 'sfdot_lens';

export const COVERAGE_DISCLAIMER =
  'Zero or few reported gaps does NOT mean the suite has complete coverage. Surpryze only compares patterns visible in test source (titles, actions, expect()). Unmodeled requirements, production behavior, and edge cases may still be untested.';

const NEGATIVE_SIGNAL = /4xx|reject|invalid|error|fail|denied|forbidden|unauthorized|expired|not found/i;

export interface TestGapRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  feature?: string;
  reason: string;
  relatedAssumptionIds: string[];
  relatedTestIds: string[];
  suggestedTestIdeas: string[];
  category: GapCategory;
  /** SFDOT lens when gap is dimension-oriented (structure, function, data, platform, operations, time). */
  sfdotDimension?: SfdotDimension;
}

export interface AssumptionsSummary {
  totalClaims: number;
  literalClaims: number;
  structuralClaims: number;
  intentClaims: number;
  byFeature: Record<
    string,
    { tests: number; assumptions: number; literalAssumptions: number }
  >;
  /** Distinct beliefs the suite encodes (prioritize literal + structural). */
  highlightedAssumptions: Array<{
    id: string;
    statement: string;
    feature?: string;
    claimPrecision: Assumption['claimPrecision'];
    evidenceClass: Assumption['evidenceClass'];
  }>;
}

function gapId(parts: string[]): string {
  return 'GAP-' + createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 8);
}

export function buildAssumptionsSummary(
  tests: ParsedTest[],
  assumptions: Assumption[],
): AssumptionsSummary {
  const byFeature: AssumptionsSummary['byFeature'] = {};

  for (const t of tests) {
    const f = t.feature ?? 'general';
    byFeature[f] ??= { tests: 0, assumptions: 0, literalAssumptions: 0 };
    byFeature[f].tests += 1;
  }

  for (const a of assumptions) {
    const f = a.feature ?? 'general';
    byFeature[f] ??= { tests: 0, assumptions: 0, literalAssumptions: 0 };
    byFeature[f].assumptions += 1;
    if (a.claimPrecision === 'literal') byFeature[f].literalAssumptions += 1;
  }

  const highlighted = assumptions
    .filter((a) => a.claimPrecision !== 'intent' || a.evidenceClass === 'UNTESTED')
    .sort(
      (a, b) =>
        rankWeakness(a.evidenceClass, a.confidence, a.claimPrecision) -
        rankWeakness(b.evidenceClass, b.confidence, b.claimPrecision),
    )
    .slice(0, 25)
    .map((a) => ({
      id: a.id,
      statement: a.statement,
      feature: a.feature,
      claimPrecision: a.claimPrecision,
      evidenceClass: a.evidenceClass,
    }));

  return {
    totalClaims: assumptions.length,
    literalClaims: assumptions.filter((a) => a.claimPrecision === 'literal').length,
    structuralClaims: assumptions.filter((a) => a.claimPrecision === 'structural').length,
    intentClaims: assumptions.filter((a) => a.claimPrecision === 'intent').length,
    byFeature,
    highlightedAssumptions: highlighted,
  };
}

export function analyzeTestingGaps(
  tests: ParsedTest[],
  graphAssumptions: AssumptionGraph['assumptions'],
): TestGapRecommendation[] {
  const recs: TestGapRecommendation[] = [];

  for (const view of graphAssumptions) {
    const a = view.assumption;
    if (a.status === 'UNTESTED' || a.evidenceClass === 'UNTESTED') {
      recs.push({
        id: gapId(['untested', a.id]),
        priority: 'high',
        feature: a.feature,
        reason: `Belief is not exercised by any test: ${a.statement}`,
        relatedAssumptionIds: [a.id],
        relatedTestIds: view.supportedByTests,
        suggestedTestIdeas:
          view.plausibleUntestedScenarios.length > 0
            ? view.plausibleUntestedScenarios.map((s) => `Scenario: ${s}`)
            : [`Add a test that confirms or refutes: ${a.statement}`],
        category: 'untested_assumption',
      });
    }

    if (view.missingEvidence.length > 0 && a.evidenceClass !== 'UNTESTED') {
      recs.push({
        id: gapId(['missing', a.id]),
        priority: 'medium',
        feature: a.feature,
        reason: `Thin evidence for: ${a.statement}`,
        relatedAssumptionIds: [a.id],
        relatedTestIds: view.supportedByTests,
        suggestedTestIdeas: [
          ...view.plausibleUntestedScenarios,
          'Strengthen with explicit expect() on outcomes, not only scenario title',
        ],
        category: 'missing_evidence',
      });
    }

    const supporting = view.evidence.filter(
      (e) => e.polarity === 'supports' && e.evidenceKind !== 'missing',
    );
    const hasAssertionEvidence = supporting.some((e) => e.refKind === 'assertion');

    const sameTestHasLiteral = (testIds: string[]) =>
      graphAssumptions.some(
        (v) =>
          v.assumption.claimPrecision === 'literal' &&
          v.supportedByTests.some((tid) => testIds.includes(tid)),
      );

    if (a.claimPrecision === 'intent' && !sameTestHasLiteral(view.supportedByTests)) {
      recs.push({
        id: gapId(['intent', a.id]),
        priority: 'low',
        feature: a.feature,
        reason: `Scenario title only (no assertion oracle): ${a.statement.replace(/^\[Intent\] /, '')}`,
        relatedAssumptionIds: [a.id],
        relatedTestIds: view.supportedByTests,
        suggestedTestIdeas: [
          'Add expect() with concrete expected text, status, or URL',
          'Keep the title for humans; let assertions hold the oracle',
        ],
        category: 'intent_only_oracle',
      });
    } else if (
      a.claimPrecision === 'structural' &&
      !sameTestHasLiteral(view.supportedByTests) &&
      a.expectedLiterals.length === 0
    ) {
      recs.push({
        id: gapId(['structural', a.id]),
        priority: 'medium',
        feature: a.feature,
        reason: `Matcher without static expected value: ${a.statement}`,
        relatedAssumptionIds: [a.id],
        relatedTestIds: view.supportedByTests,
        suggestedTestIdeas: [
          'Prefer literals in expect() (exact text, status code, URL) where possible',
          'Document dynamic oracles in code comments if literals are not feasible',
        ],
        category: 'structural_only_oracle',
      });
    } else if (!hasAssertionEvidence && supporting.length > 0) {
      recs.push({
        id: gapId(['no-assertion-evidence', a.id]),
        priority: 'medium',
        feature: a.feature,
        reason: `Claim is tied to test title/metadata only, not an assertion: ${a.statement}`,
        relatedAssumptionIds: [a.id],
        relatedTestIds: view.supportedByTests,
        suggestedTestIdeas: ['Link belief to a specific expect() in this test'],
        category: 'missing_evidence',
      });
    }

    if (view.contradictions.length > 0) {
      recs.push({
        id: gapId(['contradiction', a.id]),
        priority: 'high',
        feature: a.feature,
        reason: `Tests encode conflicting expectations around: ${a.statement}`,
        relatedAssumptionIds: [a.id, ...view.contradictions.map((c) => c.refId)],
        relatedTestIds: view.supportedByTests,
        suggestedTestIdeas: [
          'Add a single authoritative test or align tests on one expected behavior',
          'Document which assumption is correct if both are intentional',
        ],
        category: 'contradiction',
      });
    }
  }

  const byFeature = new Map<string, ParsedTest[]>();
  for (const t of tests) {
    const f = t.feature ?? 'general';
    const list = byFeature.get(f) ?? [];
    list.push(t);
    byFeature.set(f, list);
  }

  for (const [feature, featureTests] of byFeature) {
    const related = graphAssumptions.filter((v) => (v.assumption.feature ?? 'general') === feature);
    const literal = related.filter((v) => v.assumption.claimPrecision === 'literal').length;
    if (featureTests.length >= 2 && literal === 0) {
      recs.push({
        id: gapId(['weak-oracles', feature]),
        priority: 'medium',
        feature: feature === 'general' ? undefined : feature,
        reason: `Area "${feature}" has ${featureTests.length} tests but no literal expected values in assertions`,
        relatedAssumptionIds: related.map((v) => v.assumption.id).slice(0, 5),
        relatedTestIds: featureTests.map((t) => t.id),
        suggestedTestIdeas: [
          'Add toHaveText / status code / URL assertions with concrete expected values',
          'Replace title-only coverage with explicit oracles',
        ],
        category: 'weak_oracles',
      });
    }
  }

  const hasNegativeOracle = graphAssumptions.some(
    (v) =>
      v.assumption.claimPrecision === 'literal' &&
      (NEGATIVE_SIGNAL.test(v.assumption.statement) ||
        v.assumption.expectedLiterals.some((l) => /400|401|403|404|422|4\d\d/.test(l))),
  );
  const hasHappyPathApi = tests.some(
    (t) =>
      t.apiCalls.length > 0 ||
      t.assertions.some((a) => a.includes('ok') || a.includes('toBeTruthy')),
  );
  if (hasHappyPathApi && !hasNegativeOracle && tests.length >= 3) {
    recs.push({
      id: gapId(['negative-path', 'suite']),
      priority: 'medium',
      feature: undefined,
      reason:
        'Suite has success-path API/UI checks but no literal assertions for rejected/error outcomes (4xx, invalid input, etc.)',
      relatedAssumptionIds: [],
      relatedTestIds: tests.slice(0, 5).map((t) => t.id),
      suggestedTestIdeas: [
        'Add tests with expect() on 4xx responses or visible error messages',
        'Cover invalid input, unauthorized access, and expired resources',
      ],
      category: 'negative_path',
    });
  }

  const summary = buildAssumptionsSummary(
    tests,
    graphAssumptions.map((v) => v.assumption),
  );
  if (tests.length >= 2 && summary.literalClaims === 0) {
    recs.push({
      id: gapId(['weak-oracles', 'suite']),
      priority: 'high',
      feature: undefined,
      reason: `No literal expected values extracted from ${tests.length} tests (only structural/intent claims)`,
      relatedAssumptionIds: graphAssumptions.slice(0, 5).map((v) => v.assumption.id),
      relatedTestIds: tests.map((t) => t.id),
      suggestedTestIdeas: [
        'Use static strings/numbers in expect() so oracles appear in the graph',
        'Avoid relying on scenario titles alone as the oracle',
      ],
      category: 'weak_oracles',
    });
  }

  for (const t of tests) {
    if (t.actions.length > 0 && t.assertions.length === 0) {
      recs.push({
        id: gapId(['no-assert', t.id]),
        priority: 'high',
        feature: t.feature,
        reason: `Test performs actions but has no expect() assertions: ${t.title}`,
        relatedAssumptionIds: [],
        relatedTestIds: [t.id],
        suggestedTestIdeas: [
          'Add expect() matchers for the outcome of this flow',
          `File: ${t.filePath}`,
        ],
        category: 'no_assertions',
      });
    }
  }

  const assumptions = graphAssumptions.map((v) => v.assumption);
  const sfdotReport = buildSfdotCoverage(tests);
  for (const dim of sfdotReport.dimensions) {
    if (dim.strength === 'strong') continue;
    const priority = dim.strength === 'absent' ? 'medium' : 'low';
    recs.push({
      id: sfdotGapId(['sfdot', dim.dimension]),
      priority,
      reason: `SFDOT — ${dim.label}: ${dim.strength === 'absent' ? 'no clear signals' : 'weak signals'} in suite (${dim.testsWithSignal}/${dim.testsTotal} tests). ${SFDOT_LABELS[dim.dimension].description}`,
      relatedAssumptionIds: assumptions.slice(0, 3).map((a) => a.id),
      relatedTestIds: tests.slice(0, 5).map((t) => t.id),
      suggestedTestIdeas: sfdotGapSuggestions(dim.dimension),
      category: 'sfdot_lens',
      sfdotDimension: dim.dimension,
    });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const seen = new Set<string>();
  const deduped = recs
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .filter((r) => {
      const key = `${r.category}:${r.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const actionable = deduped.filter((g) => g.category !== 'analysis_limit');
  if (actionable.length === 0 && tests.length > 0) {
    deduped.push({
      id: gapId(['analysis-limit', String(tests.length)]),
      priority: 'low',
      reason:
        'Rule-based analysis did not flag specific gaps. This is not evidence of complete coverage—only that no heuristics matched.',
      relatedAssumptionIds: graphAssumptions.slice(0, 3).map((v) => v.assumption.id),
      relatedTestIds: tests.slice(0, 3).map((t) => t.id),
      suggestedTestIdeas: [
        'Compare assumptionsSummary to product requirements and risk areas',
        'Add boundary tests outside happy paths encoded in titles',
        'Run `surpryze explore` (optional) when the app is up to challenge beliefs',
      ],
      category: 'analysis_limit',
    });
  }

  return deduped;
}
