/** LLM semantic output — no confidence; Surpryze computes evidence strength. */
export interface SemanticAssumptionProposal {
  statement: string;
  feature?: string;
  rationale: string;
  derivedFromTestIds: string[];
  applicationBehaviorKnown: boolean;
}
