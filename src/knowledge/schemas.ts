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

export const ParsedTestSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  title: z.string(),
  feature: z.string().optional(),
  describePath: z.array(z.string()),
  actions: z.array(z.string()),
  assertions: z.array(z.string()),
  routes: z.array(z.string()),
  apiCalls: z.array(z.string()),
  rawSnippet: z.string().optional(),
});

export const AssumptionSchema = z.object({
  id: z.string(),
  statement: z.string(),
  feature: z.string().optional(),
  source: AssumptionSourceSchema,
  confidence: z.number().min(0).max(1),
  status: AssumptionStatusSchema,
  provenance: z.array(ProvenanceRefSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
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
export type Experiment = z.infer<typeof ExperimentSchema>;
export type Observation = z.infer<typeof ObservationSchema>;
export type Surprise = z.infer<typeof SurpriseSchema>;
export type ParsedTest = z.infer<typeof ParsedTestSchema>;
export type SurpryzeConfig = z.infer<typeof SurpryzeConfigSchema>;
