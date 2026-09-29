import type { ParsedTest } from '../knowledge/schemas.js';
import { getDefaultLlmProvider, type LlmProvider } from './provider.js';

/** LLM semantic output — no confidence; Surpryze computes evidence strength. */
export interface SemanticAssumptionProposal {
  statement: string;
  feature?: string;
  rationale: string;
  derivedFromTestIds: string[];
  applicationBehaviorKnown: boolean;
}

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

export class HeuristicSemanticAnalyzer implements SemanticAnalyzer {
  name = 'heuristic-semantic';

  async analyzeTests(tests: ParsedTest[]): Promise<SemanticAssumptionProposal[]> {
    const legacy = getDefaultLlmProvider();
    const proposals = await legacy.proposeAssumptions(tests);
    const testByFeature = new Map<string, string[]>();
    for (const t of tests) {
      const f = t.feature ?? 'general';
      const list = testByFeature.get(f) ?? [];
      list.push(t.id);
      testByFeature.set(f, list);
    }
    return proposals.map((p) => ({
      statement: p.statement,
      feature: p.feature,
      rationale: p.rationale,
      derivedFromTestIds: p.feature
        ? (testByFeature.get(p.feature) ?? tests.slice(0, 2).map((x) => x.id))
        : tests.slice(0, 1).map((x) => x.id),
      applicationBehaviorKnown: false,
    }));
  }
}

export class OpenAiSemanticAnalyzer implements SemanticAnalyzer {
  name = 'openai';

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

export function resolveSemanticAnalyzer(): SemanticAnalyzer {
  const key = process.env.SURPRYZE_LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (key) return new OpenAiSemanticAnalyzer(key);
  return new HeuristicSemanticAnalyzer();
}

/** @deprecated use resolveSemanticAnalyzer */
export type { LlmProvider };
