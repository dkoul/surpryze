import type { KnowledgeStore } from '../knowledge/store.js';

export interface ReportMetrics {
  testsAnalyzed: number;
  assumptionsDiscovered: number;
  assumptionsChallenged: number;
  experimentsRun: number;
  surprises: number;
  unexplained: number;
  potentialDefects: number;
  epistemicCoverage: number;
  assumptionCoverage: number;
  surpriseRate: number;
  knowledgeDebt: number;
  topGaps: string[];
}

export function computeMetrics(store: KnowledgeStore): ReportMetrics {
  const tests = store.countTests();
  const assumptions = store.listAssumptions();
  const experiments = store.listExperiments();
  const surprises = store.listSurprises();

  const important = assumptions.filter((a) => a.confidence >= 0.6);
  const challenged = important.filter((a) =>
    ['CHALLENGED', 'CONTRADICTED', 'CONFIRMED'].includes(a.status),
  );
  const withEvidence = important.filter((a) => a.provenance.some((p) => p.kind === 'test'));
  const unexplained = surprises.filter((s) => s.status === 'OPEN').length;
  const potentialDefects = surprises.filter((s) => s.status === 'ACCEPTED_DEFECT').length;

  const epistemicCoverage =
    important.length === 0 ? 0 : Math.round((challenged.length / important.length) * 100);
  const assumptionCoverage =
    important.length === 0 ? 0 : Math.round((withEvidence.length / important.length) * 100);
  const surpriseRate =
    experiments.length === 0 ? 0 : Math.round((surprises.length / experiments.length) * 100) / 100;

  const debtAssumptions = assumptions.filter(
    (a) =>
      a.status === 'UNTESTED' ||
      a.status === 'CONTRADICTED' ||
      (a.confidence >= 0.6 && a.status !== 'CONFIRMED'),
  );
  const topGaps = debtAssumptions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .map((a) => a.statement);

  return {
    testsAnalyzed: tests,
    assumptionsDiscovered: assumptions.length,
    assumptionsChallenged: challenged.length,
    experimentsRun: experiments.length,
    surprises: surprises.length,
    unexplained,
    potentialDefects,
    epistemicCoverage,
    assumptionCoverage,
    surpriseRate,
    knowledgeDebt: debtAssumptions.length,
    topGaps,
  };
}

export function persistMetrics(store: KnowledgeStore): ReportMetrics {
  const m = computeMetrics(store);
  store.recordMetric('epistemic_coverage', m.epistemicCoverage);
  store.recordMetric('surprise_rate', m.surpriseRate);
  return m;
}
