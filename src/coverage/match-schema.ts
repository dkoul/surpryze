import { z } from 'zod';

export const CoverageMatchSchema = z.object({
  assumptionId: z.string(),
  testIds: z.array(z.string()),
  matchStrength: z.enum(['strong', 'moderate', 'weak', 'none']),
  coverageLens: z.enum([
    'structure',
    'function',
    'data',
    'interaction',
    'platform',
    'operations',
    'time',
  ]),
  rationale: z.string(),
  gapNote: z.string().optional(),
});

export const CoverageMatchesFileSchema = z.object({
  version: z.literal(1),
  generatedBy: z.string(),
  generatedAt: z.string(),
  uiTestFramework: z.string(),
  uiTestsRoot: z.string(),
  matches: z.array(CoverageMatchSchema),
  uncoveredAssumptionIds: z.array(z.string()).optional(),
});

export type CoverageMatch = z.infer<typeof CoverageMatchSchema>;
export type CoverageMatchesFile = z.infer<typeof CoverageMatchesFileSchema>;
