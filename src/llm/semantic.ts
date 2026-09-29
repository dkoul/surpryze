import type { ParsedTest } from '../knowledge/schemas.js';
import { SemanticAnalysisRequiredError } from '../agent/semantic-task.js';
import type { SemanticAssumptionProposal } from './semantic-types.js';

export type { SemanticAssumptionProposal } from './semantic-types.js';

export interface SemanticAnalyzer {
  name: string;
  analyzeTests(tests: ParsedTest[], context?: string): Promise<SemanticAssumptionProposal[]>;
}

function testsDigest(tests: ParsedTest[]): string {
  return tests
    .map(
      (t) =>
        `### ${t.id} ${t.title}\nfile: ${t.filePath}\nfeature: ${t.feature ?? 'general'}\nactions:\n${t.actions.map((a) => `- ${a}`).join('\n')}\nassertions:\n${t.assertions.map((a) => `- ${a}`).join('\n')}`,
    )
    .join('\n\n');
}

/** Headless / CI only — requires API key. Primary path is Cursor/Claude skill + proposals file. */
export class OpenAiSemanticAnalyzer implements SemanticAnalyzer {
  name = 'openai-api';

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.SURPRYZE_LLM_MODEL ?? 'gpt-4o-mini',
  ) {}

  async analyzeTests(tests: ParsedTest[], context?: string): Promise<SemanticAssumptionProposal[]> {
    const system = `You analyze Playwright test suites. The application source may be UNAVAILABLE.
Return JSON: { "assumptions": [ { "statement", "feature?", "rationale", "derivedFromTestIds": [], "applicationBehaviorKnown": boolean } ] }
Rules:
- Candidate assumptions about what the suite believes the app does.
- Do NOT assign confidence scores.
- If behavior cannot be known without app code, set applicationBehaviorKnown false and say so in rationale.
- Link each assumption to test ids from the digest.`;

    const user = `${context ? `Context:\n${context}\n\n` : ''}Test digest:\n${testsDigest(tests)}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI semantic analysis failed (${res.status}): ${text.slice(0, 400)}`);
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content) as { assumptions?: SemanticAssumptionProposal[] };
    return (parsed.assumptions ?? []).map((a) => ({
      ...a,
      derivedFromTestIds: a.derivedFromTestIds ?? [],
      applicationBehaviorKnown: a.applicationBehaviorKnown ?? false,
    }));
  }
}

export interface ResolveSemanticOptions {
  proposalsFile?: string;
  allowApiFallback?: boolean;
}

export function resolveSemanticAnalyzer(options: ResolveSemanticOptions = {}): SemanticAnalyzer {
  if (options.proposalsFile) {
    return {
      name: 'agent-proposals-file',
      analyzeTests: async () => {
        const { loadSemanticProposalsFromFile } = await import('../agent/semantic-task.js');
        return loadSemanticProposalsFromFile(options.proposalsFile!);
      },
    };
  }

  const key = process.env.SURPRYZE_LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (options.allowApiFallback && key) {
    return new OpenAiSemanticAnalyzer(key);
  }

  throw new SemanticAnalysisRequiredError(
    `Semantic analysis is required. Surpryze is a Cursor/Claude skill — the coding agent must produce ${PROPOSALS_HINT}.

Steps:
  1. npx surpryze prepare
  2. Run the Surpryze skill (see skills/surpryze/SKILL.md) — the agent writes semantic-proposals.json
  3. npx surpryze finalize

For headless CI only, pass proposals: npx surpryze finalize --semantic-file <path>
Or set OPENAI_API_KEY and use: npx surpryze analyze --use-api`,
  );
}

const PROPOSALS_HINT = '.surpryze/semantic-proposals.json';
