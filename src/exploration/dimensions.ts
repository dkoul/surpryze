import type { ParsedTest } from '../knowledge/schemas.js';
import {
  buildSfdotCoverage,
  scoreTestOnSfdot,
  sfdotGapSuggestions,
  type SfdotDimension,
} from '../gaps/sfdot.js';

/** PRD exploration dimensions (no third-party heuristic branding). */
export type ExplorationDimension =
  | 'behavior'
  | 'data'
  | 'state'
  | 'platform'
  | 'operations'
  | 'time';

const INTERNAL_FROM_PUBLIC: Record<ExplorationDimension, SfdotDimension> = {
  behavior: 'function',
  data: 'data',
  state: 'structure',
  platform: 'platform',
  operations: 'operations',
  time: 'time',
};

const PUBLIC_LABELS: Record<ExplorationDimension, { name: string; description: string }> = {
  behavior: {
    name: 'Behavior',
    description:
      'What the application does: features, success and error paths, business rules implied by tests',
  },
  data: {
    name: 'Data',
    description:
      'Inputs, outputs, formats, boundary values, invalid data, and variation across scenarios',
  },
  state: {
    name: 'State',
    description:
      'Structure of the product under test: routes, UI regions, modules, and how pieces connect',
  },
  platform: {
    name: 'Platform',
    description: 'Browsers, APIs, environments, and external dependencies the suite touches',
  },
  operations: {
    name: 'Operations',
    description: 'End-to-end workflows, admin flows, and how users operate the product',
  },
  time: {
    name: 'Time',
    description: 'Timeouts, expiry, concurrency, scheduling, and time-dependent behavior',
  },
};

export interface ExplorationDimensionCoverage {
  dimension: ExplorationDimension;
  label: string;
  description: string;
  testsWithSignal: number;
  testsTotal: number;
  strength: 'strong' | 'moderate' | 'weak' | 'absent';
  signals: string[];
}

export interface ExplorationCoverageReport {
  dimensions: ExplorationDimensionCoverage[];
  thinDimensions: ExplorationDimension[];
}

export function buildExplorationCoverage(tests: ParsedTest[]): ExplorationCoverageReport {
  const internal = buildSfdotCoverage(tests);
  const dimensions: ExplorationDimensionCoverage[] = (
    Object.keys(PUBLIC_LABELS) as ExplorationDimension[]
  ).map((pub) => {
    const internalDim = INTERNAL_FROM_PUBLIC[pub];
    const row = internal.dimensions.find((d) => d.dimension === internalDim)!;
    return {
      dimension: pub,
      label: PUBLIC_LABELS[pub].name,
      description: PUBLIC_LABELS[pub].description,
      testsWithSignal: row.testsWithSignal,
      testsTotal: row.testsTotal,
      strength: row.strength,
      signals: row.signals,
    };
  });
  const thinDimensions = internal.thinDimensions.map(
    (d) =>
      (Object.entries(INTERNAL_FROM_PUBLIC).find(([, v]) => v === d)?.[0] ??
        'behavior') as ExplorationDimension,
  );
  return { dimensions, thinDimensions };
}

export function explorationSuggestions(dimension: ExplorationDimension): string[] {
  return sfdotGapSuggestions(INTERNAL_FROM_PUBLIC[dimension]);
}

export function scoreTestExploration(test: ParsedTest): Record<ExplorationDimension, string[]> {
  const internal = scoreTestOnSfdot(test);
  const out: Record<ExplorationDimension, string[]> = {
    behavior: [],
    data: [],
    state: [],
    platform: [],
    operations: [],
    time: [],
  };
  for (const [pub, internalDim] of Object.entries(INTERNAL_FROM_PUBLIC) as [
    ExplorationDimension,
    SfdotDimension,
  ][]) {
    out[pub] = internal[internalDim];
  }
  return out;
}
