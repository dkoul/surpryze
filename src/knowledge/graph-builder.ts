import fs from 'node:fs';
import path from 'node:path';
import type { AssumptionGraph, ParsedTest } from './schemas.js';
import { AssumptionGraphSchema } from './schemas.js';
import type { KnowledgeStore } from './store.js';
import { createHash } from 'node:crypto';
import { mineAssumptionGraph } from '../assumptions/mine.js';
import { classifyEvidence, deriveConfidenceFromEvidence, rankWeakness } from '../assumptions/confidence.js';
import type { AssumptionEvidence } from './schemas.js';

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
      evidenceClass: classifyEvidence(allEvidence, contradictions.length > 0),
      status: 'CONTRADICTED',
      updatedAt: new Date().toISOString(),
    });
  }
}

export function buildAndPersistAssumptionGraph(
  store: KnowledgeStore,
  tests: ParsedTest[],
): AssumptionGraph {
  const mined = mineAssumptionGraph(tests);
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

  const graph = assembleGraphView(store, tests);
  const jsonPath = path.join(store.surpryzeDir, 'assumption-graph.json');
  fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2));
  store.setMeta('assumptionGraphPath', jsonPath);
  store.setMeta('assumptionGraphAt', graph.generatedAt);
  return graph;
}

export function assembleGraphView(store: KnowledgeStore, tests: ParsedTest[]): AssumptionGraph {
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
        rankWeakness(a.assumption.evidenceClass, a.assumption.confidence) -
        rankWeakness(b.assumption.evidenceClass, b.assumption.confidence),
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
        confidence: a.confidence,
        status: a.status,
      },
    })),
  ];

  const weakest = weakAssumptionsFirst
    .slice(0, 8)
    .map((id) => assumptionViews.find((v) => v.assumption.id === id)!)
    .filter(Boolean);

  const graph: AssumptionGraph = {
    version: 1,
    generatedAt: new Date().toISOString(),
    projectSummary: {
      testsAnalyzed: tests.length,
      assumptions: assumptions.length,
      edges: edges.length,
    },
    nodes,
    edges,
    assumptions: assumptionViews,
    weakAssumptionsFirst,
    agentBrief: {
      whatTestsBelieve: `The suite encodes ${assumptions.length} behavioral assumptions across ${tests.length} tests.`,
      whyTheyBelieveIt: `Beliefs are backed by ${allEvidence.filter((e) => e.evidenceKind === 'direct').length} direct and ${allEvidence.filter((e) => e.evidenceKind === 'indirect').length} indirect evidence links parsed from test titles, actions, and assertions.`,
      weakestAssumptions: weakest.map((w) => ({
        id: w.assumption.id,
        statement: w.assumption.statement,
        evidenceClass: w.assumption.evidenceClass,
        confidence: w.assumption.confidence,
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
