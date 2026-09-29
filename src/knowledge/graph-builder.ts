import fs from 'node:fs';
import path from 'node:path';
import type { AssumptionGraph, ParsedTest } from './schemas.js';
import { AssumptionGraphSchema } from './schemas.js';
import type { KnowledgeStore } from './store.js';
import { createHash } from 'node:crypto';
import { mineAssumptionGraph } from '../assumptions/mine.js';
import { classifyEvidence, deriveConfidenceFromEvidence, rankWeakness } from '../assumptions/confidence.js';
import type { AssumptionEvidence } from './schemas.js';
import {
  analyzeTestingGaps,
  buildAssumptionsSummary,
  COVERAGE_DISCLAIMER,
} from '../gaps/analyzer.js';
import { buildSfdotCoverage } from '../gaps/sfdot.js';
import { buildExplorationCoverage } from '../exploration/dimensions.js';
import { writeAgentHandoff } from '../agent/handoff.js';
import { deriveAssumptionKind } from '../assumptions/kind.js';
import { writeAssumptionGraphHtml } from '../reporting/graph-html.js';
import { writeAgentContext } from '../agent/context.js';
import type { SemanticAssumptionProposal } from '../llm/semantic.js';

export interface BuildGraphOptions {
  semanticProposals?: SemanticAssumptionProposal[];
  semanticAnalyzer?: string;
  applicationSourceAvailable?: boolean;
}

function attachSurpriseContradictions(store: KnowledgeStore): void {
  for (const surprise of store.listSurprises()) {
    if (!surprise.assumptionId) continue;
    const assumption = store.getAssumption(surprise.assumptionId);
    if (!assumption) continue;
    const ev: AssumptionEvidence = {
      id:
        'EV-' +
        createHash('sha256')
          .update(`${surprise.assumptionId}|${surprise.id}|contradicts`)
          .digest('hex')
          .slice(0, 8),
      assumptionId: surprise.assumptionId,
      refKind: 'code',
      refId: surprise.id,
      refLabel: surprise.observed,
      evidenceKind: 'direct',
      polarity: 'contradicts',
      weight: 0,
    };
    store.upsertAssumptionEvidence(ev);
    const allEvidence = store.listAssumptionEvidence().filter((e) => e.assumptionId === assumption.id);
    const confidence = deriveConfidenceFromEvidence(allEvidence);
    const contradictions = allEvidence.filter((e) => e.polarity === 'contradicts');
    store.upsertAssumption({
      ...assumption,
      confidence,
      evidenceClass: classifyEvidence(allEvidence, contradictions.length > 0, assumption.claimPrecision),
      status: 'CONTRADICTED',
      updatedAt: new Date().toISOString(),
    });
  }
}

export function buildAndPersistAssumptionGraph(
  store: KnowledgeStore,
  tests: ParsedTest[],
  projectRoot?: string,
  buildOptions: BuildGraphOptions = {},
): AssumptionGraph {
  const mined = mineAssumptionGraph(tests, {
    semanticProposals: buildOptions.semanticProposals,
  });
  store.clearGraphArtifacts();

  for (const bundle of mined.bundles) {
    store.upsertAssumption(bundle.assumption);
    for (const ev of bundle.evidence) {
      store.upsertAssumptionEvidence(ev);
    }
    for (const edge of bundle.edges) {
      store.upsertGraphEdge(edge);
    }
  }

  attachSurpriseContradictions(store);

  const graph = assembleGraphView(store, tests, buildOptions);
  const graphPath = path.join(store.surpryzeDir, 'graph.json');
  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  const jsonPath = path.join(store.surpryzeDir, 'assumption-graph.json');
  fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2));
  const gapsPath = path.join(store.surpryzeDir, 'testing-gaps.json');
  fs.writeFileSync(
    gapsPath,
    JSON.stringify(
      {
        generatedAt: graph.generatedAt,
        assumptionsSummary: graph.assumptionsSummary,
        testingGaps: graph.testingGaps,
        whatToTestNext: graph.agentBrief.whatToTestNext,
        coverageDisclaimer: graph.coverageDisclaimer,
        explorationCoverage: graph.explorationCoverage,
        sfdotCoverage: graph.sfdotCoverage,
      },
      null,
      2,
    ),
  );
  store.setMeta('testingGapsPath', gapsPath);
  store.setMeta('assumptionGraphPath', graphPath);
  store.setMeta('graphPath', graphPath);
  store.setMeta('assumptionGraphAt', graph.generatedAt);

  writeAssumptionGraphHtml(graph, store.surpryzeDir);
  writeAgentContext(store.surpryzeDir, graph);

  const root = projectRoot ?? path.dirname(path.dirname(store.surpryzeDir));
  const handoffPath = writeAgentHandoff(store.surpryzeDir, root, graph);
  store.setMeta('agentHandoffPath', handoffPath);

  return graph;
}

export function assembleGraphView(
  store: KnowledgeStore,
  tests: ParsedTest[],
  buildOptions: BuildGraphOptions = {},
): AssumptionGraph {
  const assumptions = store.listAssumptions();
  const allEvidence = store.listAssumptionEvidence();
  const edges = store.listGraphEdges();

  const assumptionViews = assumptions.map((assumption) => {
    const evidence = allEvidence.filter((e) => e.assumptionId === assumption.id);
    const contradictions = evidence.filter((e) => e.polarity === 'contradicts');
    const supporting = evidence.filter((e) => e.polarity === 'supports' && e.evidenceKind !== 'missing');
    const supportedByTests = [
      ...new Set(
        supporting
          .map((e) => {
            if (e.refKind === 'test') return e.refId;
            if (e.refKind === 'assertion') {
              const owner = tests.find((t) => t.assertionDetails?.some((a) => a.id === e.refId));
              return owner?.id;
            }
            return undefined;
          })
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const missingEvidence = evidence
      .filter((e) => e.evidenceKind === 'missing')
      .map((e) => e.refLabel ?? 'No supporting test evidence');

    const plausibleUntestedScenarios = assumption.missingScenarios ?? [];

    return {
      assumption,
      assumptionKind: deriveAssumptionKind(assumption),
      evidence,
      contradictions,
      supportedByTests,
      missingEvidence,
      plausibleUntestedScenarios,
    };
  });

  const weakAssumptionsFirst = [...assumptionViews]
    .sort(
      (a, b) =>
        rankWeakness(a.assumption.evidenceClass, a.assumption.confidence, a.assumption.claimPrecision) -
        rankWeakness(b.assumption.evidenceClass, b.assumption.confidence, b.assumption.claimPrecision),
    )
    .map((v) => v.assumption.id);

  const nodes = [
    ...tests.map((t) => ({
      id: t.id,
      type: 'test' as const,
      label: t.title,
      meta: { filePath: t.filePath, feature: t.feature },
    })),
    ...tests.flatMap((t) =>
      (t.assertionDetails ?? []).map((a) => ({
        id: a.id,
        type: 'assertion' as const,
        label: a.expression,
        meta: { testId: t.id, line: a.line },
      })),
    ),
    ...assumptions.map((a) => ({
      id: a.id,
      type: 'assumption' as const,
      label: a.statement,
      meta: {
        evidenceClass: a.evidenceClass,
        claimPrecision: a.claimPrecision,
        confidence: a.confidence,
        expectedLiterals: a.expectedLiterals,
        status: a.status,
      },
    })),
  ];

  const weakest = weakAssumptionsFirst
    .slice(0, 8)
    .map((id) => assumptionViews.find((v) => v.assumption.id === id)!)
    .filter(Boolean);

  const assumptionsSummary = buildAssumptionsSummary(tests, assumptions);
  const testingGaps = analyzeTestingGaps(tests, assumptionViews);
  const sfdotCoverage = buildSfdotCoverage(tests);
  const explorationCoverage = buildExplorationCoverage(tests);
  const whatToTestNext = testingGaps
    .filter((g) => g.priority === 'high')
    .slice(0, 8)
    .map((g) => g.suggestedTestIdeas[0] ?? g.reason);

  const appSource = buildOptions.applicationSourceAvailable ?? false;
  const graph: AssumptionGraph = {
    version: 2,
    generatedAt: new Date().toISOString(),
    applicationSourceAvailable: appSource,
    semanticAnalyzer: buildOptions.semanticAnalyzer,
    projectSummary: {
      testsAnalyzed: tests.length,
      assumptions: assumptions.length,
      edges: edges.length,
      testingGaps: testingGaps.length,
    },
    assumptionsSummary,
    testingGaps,
    coverageDisclaimer: COVERAGE_DISCLAIMER,
    sfdotCoverage,
    explorationCoverage,
    nodes,
    edges,
    assumptions: assumptionViews,
    weakAssumptionsFirst,
    agentBrief: {
      whatTestsBelieve: `The suite encodes ${assumptions.length} claims across ${tests.length} tests (${assumptions.filter((a) => a.claimPrecision === 'literal').length} with literal expected values).`,
      whyTheyBelieveIt: `Semantic analysis (${buildOptions.semanticAnalyzer ?? 'none'}) plus AST mining. ${allEvidence.filter((e) => e.evidenceKind === 'direct').length} direct evidence links tie tests/assertions to claims.`,
      fidelityNote:
        'Assumptions combine LLM semantic interpretation with structural test parsing. claimPrecision=literal means expected values were read from source; structural means matcher type without a static value; intent means title-only or semantic inference. confidence is computed from evidence (directness, independence, contradictions)—not from LLM self-scores. Application source ' +
        (appSource ? 'was available as optional evidence.' : 'was not provided—unknown behavior stays UNKNOWN, not "false".') +
        ' Gaps are not automatic defects.',
      whatToTestNext,
      weakestAssumptions: weakest.map((w) => ({
        id: w.assumption.id,
        statement: w.assumption.statement,
        evidenceClass: w.assumption.evidenceClass,
        claimPrecision: w.assumption.claimPrecision,
        confidence: w.assumption.confidence,
        expectedLiterals: w.assumption.expectedLiterals,
        supportingEvidence: w.evidence
          .filter((e) => e.polarity === 'supports' && e.evidenceKind !== 'missing')
          .map((e) => `${e.evidenceKind}:${e.refKind}:${e.refId}${e.refLabel ? ` (${e.refLabel})` : ''}`),
        gaps: [...w.missingEvidence, ...w.plausibleUntestedScenarios],
      })),
    },
  };

  return AssumptionGraphSchema.parse(graph);
}

export function loadAssumptionGraph(store: KnowledgeStore, tests: ParsedTest[]): AssumptionGraph {
  return assembleGraphView(store, tests);
}
