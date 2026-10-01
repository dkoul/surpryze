/**
 * Internal coverage lenses for gap analysis (do not expose acronym/branding in user-facing copy).
 * Maps to structure, behavior, data, interaction surfaces, platform, operations, time.
 */
export type CoverageLens =
  | 'structure'
  | 'function'
  | 'data'
  | 'interaction'
  | 'platform'
  | 'operations'
  | 'time';

export const COVERAGE_LENS_GUIDANCE: Record<
  CoverageLens,
  { label: string; agentPrompt: string }
> = {
  structure: {
    label: 'Structure',
    agentPrompt: 'How the UI is composed: routes, regions, navigation, modules.',
  },
  function: {
    label: 'Behavior',
    agentPrompt: 'What the product does: features, success paths, errors, business rules.',
  },
  data: {
    label: 'Data',
    agentPrompt: 'Inputs, outputs, validation, formats, boundaries, persistence.',
  },
  interaction: {
    label: 'Interaction',
    agentPrompt: 'Controls, forms, affordances, user-visible states and feedback.',
  },
  platform: {
    label: 'Platform',
    agentPrompt: 'APIs, browsers, environments, third-party services, dependencies.',
  },
  operations: {
    label: 'Operations',
    agentPrompt: 'End-to-end workflows, admin flows, multi-step journeys.',
  },
  time: {
    label: 'Time',
    agentPrompt: 'Timeouts, expiry, concurrency, scheduling, session lifetime.',
  },
};

export function lensChecklistForAgent(): string {
  return (Object.keys(COVERAGE_LENS_GUIDANCE) as CoverageLens[])
    .map((k) => `- **${COVERAGE_LENS_GUIDANCE[k].label}**: ${COVERAGE_LENS_GUIDANCE[k].agentPrompt}`)
    .join('\n');
}

export function inferLensFromSignals(signals: string[]): CoverageLens {
  const s = signals.join(' ').toLowerCase();
  if (/fetch|api|axios|graphql|http/.test(s)) return 'platform';
  if (/route|router|path:|navigate|href/.test(s)) return 'structure';
  if (/form|input|submit|onchange|onclick|button/.test(s)) return 'interaction';
  if (/timeout|interval|date|expir|schedule/.test(s)) return 'time';
  if (/usestate|store|redux|context|persist/.test(s)) return 'data';
  if (/workflow|step|checkout|onboard/.test(s)) return 'operations';
  return 'function';
}
