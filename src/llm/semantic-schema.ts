import { z } from 'zod';

export const SemanticAssumptionProposalSchema = z.object({
  statement: z.string().min(1),
  feature: z.string().optional(),
  rationale: z.string().min(1),
  derivedFromTestIds: z.array(z.string()).default([]),
  applicationBehaviorKnown: z.boolean().default(false),
});

export const SemanticProposalsFileSchema = z.object({
  version: z.literal(1),
  generatedBy: z.string().min(1),
  generatedAt: z.string(),
  assumptions: z.array(SemanticAssumptionProposalSchema).min(1),
});

export type SemanticProposalsFile = z.infer<typeof SemanticProposalsFileSchema>;
