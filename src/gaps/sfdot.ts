import type { ParsedTest } from '../knowledge/schemas.js';
import { createHash } from 'node:crypto';

/** SFDOT — structure, function, data, platform, operations, time */
export type SfdotDimension = 'structure' | 'function' | 'data' | 'platform' | 'operations' | 'time';

export const SFDOT_LABELS: Record<SfdotDimension, { name: string; description: string }> = {
  structure: {
    name: 'Structure',
    description:
      'What the product is made of: modules, routes, files, components, architecture, how it is built',
  },
  function: {
    name: 'Function',
    description:
      'What the product does: features, business logic, calculations, success and error-handling behavior',
  },
  data: {
    name: 'Data',
    description:
      'What is processed, stored, received, output: boundary values, invalid inputs, formats, volume',
  },
  platform: {
    name: 'Platform',
    description:
      'Dependencies: OS, browsers, hardware, external APIs, environments, third-party services',
  },
  operations: {
    name: 'Operations',
    description:
      'Real-world use: end-to-end workflows, admin/install, routines, how users operate the product',
  },
  time: {
    name: 'Time',
    description:
      'Time effects: timeouts, pacing, concurrency, scheduling, dates, expiry, DST/leap-year edges',
  },
};

export interface SfdotDimensionCoverage {
  dimension: SfdotDimension;
  label: string;
  description: string;
  testsWithSignal: number;
  testsTotal: number;
  strength: 'strong' | 'moderate' | 'weak' | 'absent';
  signals: string[];
}

export interface SfdotCoverageReport {
  dimensions: SfdotDimensionCoverage[];
  /** Dimensions that look under-tested in this suite (heuristic). */
  thinDimensions: SfdotDimension[];
}

function gapId(parts: string[]): string {
  return 'GAP-' + createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 8);
}

const STRUCTURE =
  /module|api\/|route|component|page|screen|layer|service|controller|schema|file|architect/i;
const FUNCTION =
  /should|can|must|reset|login|checkout|pay|submit|create|delete|update|validate|calculate|error|success|fail|handle/i;
const DATA =
  /invalid|boundary|empty|null|max|min|length|unicode|special|charset|email|password|payload|json|csv|large|zero/i;
const PLATFORM =
  /browser|chrome|firefox|webkit|mobile|api|http|https|external|webhook|oauth|env|staging|prod|docker/i;
const OPERATIONS =
  /workflow|flow|journey|admin|install|onboard|routine|e2e|end.to.end|user.*path|scenario/i;
const TIME =
  /expir|timeout|wait|delay|concurrent|parallel|race|schedule|cron|date|time|leap|dst|ttl|session.*length/i;

export function scoreTestOnSfdot(test: ParsedTest): Record<SfdotDimension, string[]> {
  const text = `${test.title} ${test.filePath} ${test.routes.join(' ')} ${test.assertions.join(' ')}`;
  const signals: Record<SfdotDimension, string[]> = {
    structure: [],
    function: [],
    data: [],
    platform: [],
    operations: [],
    time: [],
  };

  if (STRUCTURE.test(text) || test.routes.length > 0 || test.describePath.length > 1) {
    signals.structure.push('routes/describe/module structure in test');
  }
  if (test.filePath.includes('/')) {
    signals.structure.push(`file layout: ${test.filePath}`);
  }

  if (FUNCTION.test(text) || test.assertions.length > 0 || test.feature) {
    signals.function.push('functional assertions or feature grouping');
  }

  const hasLiterals = (test.assertionDetails ?? []).some((a) => (a.expectedLiterals?.length ?? 0) > 0);
  if (DATA.test(text) || hasLiterals || test.actions.some((a) => a.includes('fill'))) {
    signals.data.push(hasLiterals ? 'literal data oracles' : 'data-related actions/titles');
  }

  if (
    PLATFORM.test(text) ||
    test.apiCalls.length > 0 ||
    test.routes.some((r) => r.startsWith('http'))
  ) {
    signals.platform.push('API/HTTP or platform keywords');
  }

  if (OPERATIONS.test(text) || test.actions.length >= 3 || test.describePath.length >= 2) {
    signals.operations.push('multi-step or workflow-style test');
  }

  if (TIME.test(text) || test.actions.some((a) => a.includes('wait'))) {
    signals.time.push('time/expiry/concurrency keywords or waits');
  }

  return signals;
}

export function buildSfdotCoverage(tests: ParsedTest[]): SfdotCoverageReport {
  const totals = tests.length;
  const dimSignals: Record<SfdotDimension, Set<string>> = {
    structure: new Set(),
    function: new Set(),
    data: new Set(),
    platform: new Set(),
    operations: new Set(),
    time: new Set(),
  };

  for (const t of tests) {
    const scores = scoreTestOnSfdot(t);
    for (const d of Object.keys(scores) as SfdotDimension[]) {
      if (scores[d].length > 0) dimSignals[d].add(t.id);
    }
  }

  const dimensions: SfdotDimensionCoverage[] = (Object.keys(SFDOT_LABELS) as SfdotDimension[]).map(
    (dimension) => {
      const count = dimSignals[dimension].size;
      const ratio = totals === 0 ? 0 : count / totals;
      let strength: SfdotDimensionCoverage['strength'] = 'absent';
      if (ratio >= 0.35) strength = 'strong';
      else if (ratio >= 0.15) strength = 'moderate';
      else if (count > 0) strength = 'weak';

      return {
        dimension,
        label: SFDOT_LABELS[dimension].name,
        description: SFDOT_LABELS[dimension].description,
        testsWithSignal: count,
        testsTotal: totals,
        strength,
        signals: [],
      };
    },
  );

  const thinDimensions = dimensions
    .filter((d) => d.strength === 'weak' || d.strength === 'absent')
    .map((d) => d.dimension);

  return { dimensions, thinDimensions };
}

const SFDOT_SUGGESTIONS: Record<SfdotDimension, string[]> = {
  structure: [
    'Add tests per major module, route, or API surface (not only one happy path)',
    'Assert responses or UI for distinct structural endpoints or pages',
    'Cover error paths per service boundary',
  ],
  function: [
    'Map each business rule to an explicit expect(); reduce title-only oracles',
    'Add tests for alternate functional outcomes (success vs handled failure)',
  ],
  data: [
    'Vary inputs: boundaries, empty, invalid, max length, special characters',
    'Use literal expect() on outputs so data oracles appear in the graph',
    'Pair valid and invalid data classes for the same flow',
  ],
  platform: [
    'Exercise external API contracts (status codes, error bodies) in tests',
    'Add cross-browser or environment-specific smoke if Playwright projects differ',
    'Test dependency failures (API down, 503) where relevant',
  ],
  operations: [
    'Cover full user workflows (setup → act → verify), not isolated micro-steps',
    'Add admin/install/onboarding paths if the product supports them',
  ],
  time: [
    'Test expiry, timeouts, and “too slow” behavior where the product is time-sensitive',
    'Add concurrency/double-submit scenarios for idempotent flows',
    'Consider date-boundary cases if the domain uses dates or TTLs',
  ],
};

export function sfdotGapSuggestions(dimension: SfdotDimension): string[] {
  return SFDOT_SUGGESTIONS[dimension];
}

export { gapId as sfdotGapId };
