import { z } from 'zod';

export const ResultStateSchema = z.enum([
  'PASS',
  'FAIL',
  'UNKNOWN',
  'SURPRISE',
  'CONTRADICTION',
  'EXPLAINED',
]);

export const AssumptionSourceSchema = z.enum([
  'requirement',
  'test',
  'inferred',
  'experiment',
  'human',
  'documentation',
]);

export const AssumptionStatusSchema = z.enum([
  'UNTESTED',
  'TESTED',
  'CHALLENGED',
  'CONFIRMED',
  'REJECTED',
  'CONTRADICTED',
]);

/** Evidence strength classification for assumptions with insufficient support. */
export const EvidenceClassSchema = z.enum(['STRONG', 'WEAK', 'UNTESTED', 'UNKNOWN']);

/** How precisely the claim states an expected outcome (vs. structural/intent-only). */
export const ClaimPrecisionSchema = z.enum(['literal', 'structural', 'intent']);

export const EvidenceKindSchema = z.enum(['direct', 'indirect', 'inferred', 'missing']);

export const EvidencePolaritySchema = z.enum(['supports', 'contradicts']);

export const GraphRelationSchema = z.enum([
  'supports',
  'contradicts',
  'derived_from',
  'evidence_for',
  'child_of',
  'related_to',
  'challenged_by',
  'addressed_by',
]);

export const AssumptionKindSchema = z.enum([
  'explicit',
  'inferred',
  'supported',
  'weak',
  'unknown',
]);

export const ExplorationDimensionSchema = z.enum([
  'behavior',
  'data',
  'state',
  'platform',
  'operations',
  'time',
]);

export const ExplorationDimensionCoverageSchema = z.object({
  dimension: ExplorationDimensionSchema,
  label: z.string(),
  description: z.string(),
  testsWithSignal: z.number(),
  testsTotal: z.number(),
  strength: z.enum(['strong', 'moderate', 'weak', 'absent']),
  signals: z.array(z.string()),
});

export const ExplorationCoverageReportSchema = z.object({
  dimensions: z.array(ExplorationDimensionCoverageSchema),
  thinDimensions: z.array(ExplorationDimensionSchema),
});

export const ExplorationStrategySchema = z.enum([
  'boundary',
  'sequence',
  'state',
  'interaction',
  'contradiction',
  'novelty',
]);

export const ProvenanceRefSchema = z.object({
  kind: z.string(),
  id: z.string(),
  label: z.string().optional(),
});

export const ParsedAssertionSchema = z.object({
  id: z.string(),
  expression: z.string(),
  line: z.number().optional(),
  matcher: z.string().optional(),
  negated: z.boolean().optional(),
  subjectHint: z.string().optional(),
  expectedLiterals: z.array(z.string()).optional(),
  hasDynamicExpected: z.boolean().optional(),
});

export const ParsedTestSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  title: z.string(),
  feature: z.string().optional(),
  describePath: z.array(z.string()),
  actions: z.array(z.string()),
  assertions: z.array(z.string()),
  assertionDetails: z.array(ParsedAssertionSchema).optional(),
  routes: z.array(z.string()),
  apiCalls: z.array(z.string()),
  rawSnippet: z.string().optional(),
});

export const AssumptionEvidenceSchema = z.object({
  id: z.string(),
  assumptionId: z.string(),
  refKind: z.enum(['test', 'assertion', 'requirement', 'code', 'assumption']),
  refId: z.string(),
  refLabel: z.string().optional(),
  evidenceKind: EvidenceKindSchema,
  polarity: EvidencePolaritySchema,
  weight: z.number(),
});

export const GraphEdgeSchema = z.object({
  id: z.string(),
  fromKind: z.enum(['test', 'assertion', 'assumption', 'requirement', 'evidence']),
  fromId: z.string(),
  toKind: z.enum(['test', 'assertion', 'assumption', 'requirement', 'evidence']),
  toId: z.string(),
  relation: GraphRelationSchema,
  evidenceKind: EvidenceKindSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AssumptionSchema = z.object({
  id: z.string(),
  statement: z.string(),
  statementHash: z.string().optional(),
  feature: z.string().optional(),
  source: AssumptionSourceSchema,
  confidence: z.number().min(0).max(1),
  evidenceClass: EvidenceClassSchema,
  claimPrecision: ClaimPrecisionSchema,
  expectedLiterals: z.array(z.string()).default([]),
  status: AssumptionStatusSchema,
  provenance: z.array(ProvenanceRefSchema),
  missingScenarios: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TestGapRecommendationSchema = z.object({
  id: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  feature: z.string().optional(),
  reason: z.string(),
  relatedAssumptionIds: z.array(z.string()),
  relatedTestIds: z.array(z.string()),
  suggestedTestIdeas: z.array(z.string()),
  category: z.enum([
    'untested_assumption',
    'missing_evidence',
    'contradiction',
    'weak_oracles',
    'no_assertions',
    'intent_only_oracle',
    'structural_only_oracle',
    'negative_path',
    'analysis_limit',
    'sfdot_lens',
    'exploration_lens',
  ]),
  sfdotDimension: z
    .enum(['structure', 'function', 'data', 'platform', 'operations', 'time'])
    .optional(),
  explorationDimension: ExplorationDimensionSchema.optional(),
});

export const SfdotDimensionCoverageSchema = z.object({
  dimension: z.enum(['structure', 'function', 'data', 'platform', 'operations', 'time']),
  label: z.string(),
  description: z.string(),
  testsWithSignal: z.number(),
  testsTotal: z.number(),
  strength: z.enum(['strong', 'moderate', 'weak', 'absent']),
  signals: z.array(z.string()),
});

export const SfdotCoverageReportSchema = z.object({
  dimensions: z.array(SfdotDimensionCoverageSchema),
  thinDimensions: z.array(z.enum(['structure', 'function', 'data', 'platform', 'operations', 'time'])),
});

export const AssumptionsSummarySchema = z.object({
  totalClaims: z.number(),
  literalClaims: z.number(),
  structuralClaims: z.number(),
  intentClaims: z.number(),
  byFeature: z.record(
    z.object({
      tests: z.number(),
      assumptions: z.number(),
      literalAssumptions: z.number(),
    }),
  ),
  highlightedAssumptions: z.array(
    z.object({
      id: z.string(),
      statement: z.string(),
      feature: z.string().optional(),
      claimPrecision: ClaimPrecisionSchema,
      evidenceClass: EvidenceClassSchema,
    }),
  ),
});

export const AssumptionGraphSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  generatedAt: z.string(),
  applicationSourceAvailable: z.boolean().optional(),
  semanticAnalyzer: z.string().optional(),
  projectSummary: z.object({
    testsAnalyzed: z.number(),
    assumptions: z.number(),
    edges: z.number(),
    testingGaps: z.number(),
  }),
  assumptionsSummary: AssumptionsSummarySchema,
  testingGaps: z.array(TestGapRecommendationSchema),
  coverageDisclaimer: z.string(),
  sfdotCoverage: SfdotCoverageReportSchema,
  explorationCoverage: ExplorationCoverageReportSchema.optional(),
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['assumption', 'test', 'assertion']),
      label: z.string(),
      meta: z.record(z.unknown()).optional(),
    }),
  ),
  edges: z.array(GraphEdgeSchema),
  assumptions: z.array(
    z.object({
      assumption: AssumptionSchema,
      assumptionKind: AssumptionKindSchema.optional(),
      evidence: z.array(AssumptionEvidenceSchema),
      contradictions: z.array(AssumptionEvidenceSchema),
      supportedByTests: z.array(z.string()),
      missingEvidence: z.array(z.string()),
      plausibleUntestedScenarios: z.array(z.string()),
    }),
  ),
  weakAssumptionsFirst: z.array(z.string()),
  agentBrief: z.object({
    whatTestsBelieve: z.string(),
    whyTheyBelieveIt: z.string(),
    fidelityNote: z.string(),
    whatToTestNext: z.array(z.string()),
    weakestAssumptions: z.array(
      z.object({
        id: z.string(),
        statement: z.string(),
        evidenceClass: EvidenceClassSchema,
        claimPrecision: ClaimPrecisionSchema,
        confidence: z.number(),
        expectedLiterals: z.array(z.string()),
        supportingEvidence: z.array(z.string()),
        gaps: z.array(z.string()),
      }),
    ),
  }),
});

export const ExperimentSchema = z.object({
  id: z.string(),
  hypothesis: z.string(),
  strategy: ExplorationStrategySchema,
  assumptionIds: z.array(z.string()),
  steps: z.array(z.string()),
  expected: z.record(z.string()).optional(),
  budgetMs: z.number().optional(),
  scriptPath: z.string().optional(),
  createdAt: z.string(),
});

export const ObservationSchema = z.object({
  id: z.string(),
  experimentId: z.string(),
  result: ResultStateSchema,
  payload: z.record(z.unknown()),
  tracePath: z.string().optional(),
  createdAt: z.string(),
});

export const SurpriseSchema = z.object({
  id: z.string(),
  feature: z.string().optional(),
  expected: z.string(),
  observed: z.string(),
  assumptionId: z.string().optional(),
  experimentId: z.string(),
  observationId: z.string(),
  evidence: z.array(ProvenanceRefSchema),
  impact: z.string().optional(),
  confidence: z.number(),
  status: z.enum(['OPEN', 'EXPLAINED', 'ACCEPTED_DEFECT', 'ACCEPTED_EXPECTED', 'IGNORED']),
  createdAt: z.string(),
});

export const InvestigationClassificationSchema = z.enum([
  'known_undocumented',
  'requirement_ambiguity',
  'oracle_problem',
  'environmental',
  'expected_edge_case',
  'potential_defect',
]);

export const SurpryzeConfigSchema = z.object({
  version: z.literal(1),
  projectRoot: z.string(),
  playwrightConfig: z.string().optional(),
  testDir: z.string().optional(),
  surpryzeDir: z.string(),
  defaultExploreBudget: z.number().default(20),
  maxConcurrency: z.number().default(2),
  environment: z.enum(['test', 'staging']).default('test'),
});

export type ResultState = z.infer<typeof ResultStateSchema>;
export type Assumption = z.infer<typeof AssumptionSchema>;
export type AssumptionEvidence = z.infer<typeof AssumptionEvidenceSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type AssumptionGraph = z.infer<typeof AssumptionGraphSchema>;
export type TestGapRecommendation = z.infer<typeof TestGapRecommendationSchema>;
export type AssumptionsSummary = z.infer<typeof AssumptionsSummarySchema>;
export type EvidenceClass = z.infer<typeof EvidenceClassSchema>;
export type ClaimPrecision = z.infer<typeof ClaimPrecisionSchema>;
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;
export type ParsedAssertion = z.infer<typeof ParsedAssertionSchema>;
export type Experiment = z.infer<typeof ExperimentSchema>;
export type Observation = z.infer<typeof ObservationSchema>;
export type Surprise = z.infer<typeof SurpriseSchema>;
export type ParsedTest = z.infer<typeof ParsedTestSchema>;
export type SurpryzeConfig = z.infer<typeof SurpryzeConfigSchema>;
export type AssumptionKind = z.infer<typeof AssumptionKindSchema>;
export type ExplorationCoverageReport = z.infer<typeof ExplorationCoverageReportSchema>;
