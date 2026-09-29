import fs from 'node:fs';
import path from 'node:path';
import type { ParsedTest } from '../knowledge/schemas.js';
import { SemanticProposalsFileSchema } from '../llm/semantic-schema.js';
import type { SemanticAssumptionProposal } from '../llm/semantic.js';

export const SEMANTIC_DIR = 'semantic-analysis';
export const PROPOSALS_FILENAME = 'semantic-proposals.json';
export const PROMPT_FILENAME = 'AGENT-PROMPT.md';

export function semanticDir(surpryzeDir: string): string {
  return path.join(surpryzeDir, SEMANTIC_DIR);
}

export function proposalsPath(surpryzeDir: string): string {
  return path.join(surpryzeDir, PROPOSALS_FILENAME);
}

export function buildTestsDigest(tests: ParsedTest[]): object {
  return {
    testsAnalyzed: tests.length,
    applicationSourceAvailable: false,
    tests: tests.map((t) => ({
      id: t.id,
      title: t.title,
      filePath: t.filePath,
      feature: t.feature,
      describePath: t.describePath,
      actions: t.actions,
      assertions: t.assertions,
      assertionDetails: t.assertionDetails,
      routes: t.routes,
      apiCalls: t.apiCalls,
    })),
  };
}

export function writeSemanticPrepareArtifacts(
  surpryzeDir: string,
  tests: ParsedTest[],
  projectRoot: string,
): { promptPath: string; digestPath: string; proposalsPath: string } {
  const dir = semanticDir(surpryzeDir);
  fs.mkdirSync(dir, { recursive: true });

  const digestPath = path.join(dir, 'tests-digest.json');
  fs.writeFileSync(digestPath, JSON.stringify(buildTestsDigest(tests), null, 2));

  const promptPath = path.join(dir, PROMPT_FILENAME);
  const proposalsOut = proposalsPath(surpryzeDir);

  const prompt = `# Surpryze semantic analysis (required)

You are the **LLM layer** of Surpryze. Structural parsing already ran via \`surpryze prepare\`. **You must** infer what the Playwright suite believes about application behavior.

## Inputs

- \`${digestPath}\` — parsed tests (ids, titles, actions, assertions)
- Optional: requirements, OpenAPI, or app docs the user provides

Application source may be **unavailable**. Mark \`applicationBehaviorKnown: false\` when behavior is not evidenced in tests.

## Your output

Write **exactly** this file (create parent dirs if needed):

\`${proposalsOut}\`

\`\`\`json
{
  "version": 1,
  "generatedBy": "cursor|claude-code|…",
  "generatedAt": "<ISO8601>",
  "assumptions": [
    {
      "statement": "…",
      "feature": "optional",
      "rationale": "why the suite implies this",
      "derivedFromTestIds": ["T-…"],
      "applicationBehaviorKnown": false
    }
  ]
}
\`\`\`

## Rules

1. **Do not** assign confidence scores — Surpryze computes evidence from structure + your proposals.
2. Every assumption must link to at least one \`derivedFromTestIds\` entry from the digest (or mark unknown behavior explicitly).
3. Distinguish **what tests assert** vs **what you infer** in \`rationale\`.
4. Include implicit behavioral beliefs (flows, error handling, data rules) not visible in matchers alone.
5. Minimum **5** assumptions for non-trivial suites (or one per test if suite is tiny).

## Finish

Run: \`npx surpryze finalize\` from project root \`${projectRoot}\`

Then summarize weakest assumptions from \`.surpryze/agent-context.md\` for the user.
`;

  fs.writeFileSync(promptPath, prompt);

  fs.writeFileSync(
    path.join(dir, 'status.json'),
    JSON.stringify({ phase: 'awaiting_semantic_proposals', preparedAt: new Date().toISOString() }, null, 2),
  );

  return { promptPath, digestPath, proposalsPath: proposalsOut };
}

export function loadSemanticProposalsFromFile(filePath: string): SemanticAssumptionProposal[] {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const parsed = SemanticProposalsFileSchema.parse(raw);
  return parsed.assumptions;
}

export class SemanticAnalysisRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SemanticAnalysisRequiredError';
  }
}
