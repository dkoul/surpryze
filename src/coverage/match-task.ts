import fs from 'node:fs';
import path from 'node:path';
import type { AssumptionGraph } from '../knowledge/schemas.js';
import type { UiTestDigestEntry } from '../ui-tests/digest.js';
import { lensChecklistForAgent } from '../heuristics/coverage-lenses.js';

export const COVERAGE_MATCH_DIR = 'coverage-match';
export const COVERAGE_MATCHES_FILE = 'coverage-matches.json';
export const COVERAGE_PROMPT_FILE = 'AGENT-PROMPT.md';

export function writeCoverageMatchTask(
  surpryzeDir: string,
  graph: AssumptionGraph,
  digest: UiTestDigestEntry[],
  uiTestsRoot: string,
  frameworkLabel: string,
): { promptPath: string; digestPath: string; outputPath: string } {
  const dir = path.join(surpryzeDir, COVERAGE_MATCH_DIR);
  fs.mkdirSync(dir, { recursive: true });

  const digestPath = path.join(dir, 'ui-tests-digest.json');
  fs.writeFileSync(
    digestPath,
    JSON.stringify({ uiTestsRoot, framework: frameworkLabel, tests: digest }, null, 2),
  );

  const assumptionsPayload = graph.assumptions.map((v) => ({
    id: v.assumption.id,
    statement: v.assumption.statement,
    feature: v.assumption.feature,
    source: v.assumption.source,
    evidenceClass: v.assumption.evidenceClass,
  }));

  const graphSlicePath = path.join(dir, 'app-assumptions.json');
  fs.writeFileSync(graphSlicePath, JSON.stringify({ assumptions: assumptionsPayload }, null, 2));

  const outputPath = path.join(surpryzeDir, COVERAGE_MATCHES_FILE);
  const promptPath = path.join(dir, COVERAGE_PROMPT_FILE);

  const prompt = `# Surpryze — semantic UI test coverage match (required)

You are the **Claude/Cursor agent** for step 2: map UI tests onto the **application assumption graph** from step 1.

## Inputs

- \`${graphSlicePath}\` — assumptions mined from the React codebase (\`scan-app\`)
- \`${digestPath}\` — UI tests (Playwright, Cypress, or Selenium) from \`${uiTestsRoot}\`

## Coverage lenses (use internally; do not name any external methodology)

${lensChecklistForAgent()}

For each assumption, decide which tests (if any) **semantically** exercise that belief—not merely mention similar strings.

## Output

Write \`${outputPath}\`:

\`\`\`json
{
  "version": 1,
  "generatedBy": "claude|cursor",
  "generatedAt": "<ISO8601>",
  "uiTestFramework": "${frameworkLabel}",
  "uiTestsRoot": "${uiTestsRoot}",
  "matches": [
    {
      "assumptionId": "A-…",
      "testIds": ["T-… or UT-…"],
      "matchStrength": "strong|moderate|weak|none",
      "coverageLens": "structure|function|data|interaction|platform|operations|time",
      "rationale": "…",
      "gapNote": "optional — what evidence is still missing"
    }
  ],
  "uncoveredAssumptionIds": ["A-…"]
}
\`\`\`

## Rules

1. **Semantic match** — same user journey, API, route, or behavior; not keyword overlap alone.
2. \`none\` / empty \`testIds\` means a real coverage gap relative to the graph.
3. Do **not** treat gaps as production defects.
4. Assign each match a \`coverageLens\` from the list above.
5. Include **every** assumption id from the graph in \`matches\` or \`uncoveredAssumptionIds\`.

## Finish

Run: \`npx surpryze match finalize\`
`;

  fs.writeFileSync(promptPath, prompt);
  fs.writeFileSync(
    path.join(dir, 'status.json'),
    JSON.stringify({ phase: 'awaiting_coverage_matches', preparedAt: new Date().toISOString() }, null, 2),
  );

  return { promptPath, digestPath, outputPath };
}
