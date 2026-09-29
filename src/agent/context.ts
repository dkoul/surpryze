import fs from 'node:fs';
import path from 'node:path';
import type { AssumptionGraph } from '../knowledge/schemas.js';
import { deriveAssumptionKind } from '../assumptions/kind.js';
import type { ConfidenceDelta } from '../knowledge/confidence-run.js';

export interface AgentContextOptions {
  assumptionId?: string;
  weakest?: number;
  confidenceDeltas?: ConfidenceDelta[];
}

function relationLabel(relation: string): string {
  const map: Record<string, string> = {
    supports: 'supported_by',
    evidence_for: 'supported_by',
    contradicts: 'contradicted_by',
    derived_from: 'derived_from',
    child_of: 'derived_from',
    related_to: 'related_to',
  };
  return map[relation] ?? relation;
}

export function buildAgentContextMarkdown(
  graph: AssumptionGraph,
  options: AgentContextOptions = {},
): string {
  const lines: string[] = [];
  lines.push('# Surpryze agent context');
  lines.push('');
  lines.push(`Generated: ${graph.generatedAt}`);
  lines.push('');
  lines.push('## Epistemic stance');
  lines.push('');
  lines.push(graph.coverageDisclaimer);
  lines.push('');
  lines.push(graph.agentBrief.fidelityNote);
  lines.push('');
  lines.push(
    'Surpryze identifies **uncertainty** in what the test suite believes. It does not automatically label gaps as defects.',
  );
  lines.push('');
  lines.push('## Application repository');
  lines.push('');
  lines.push(
    'Application source is **optional**. Where behavior is not evidenced in tests, assumptions may be `unknown` rather than "absent in production".',
  );
  lines.push('');

  if (options.confidenceDeltas && options.confidenceDeltas.length > 0) {
    lines.push('## Confidence changes since last run');
    lines.push('');
    for (const d of options.confidenceDeltas.slice(0, 15)) {
      const sign = (d.delta ?? 0) > 0 ? '+' : '';
      lines.push(
        `- \`${d.assumptionId}\` ${sign}${((d.delta ?? 0) * 100).toFixed(1)}% — ${d.statement.slice(0, 120)}`,
      );
    }
    lines.push('');
  }

  let views = [...graph.assumptions];
  if (options.assumptionId) {
    views = views.filter((v) => v.assumption.id === options.assumptionId);
    if (views.length === 0) {
      lines.push(`No assumption found: \`${options.assumptionId}\``);
      return lines.join('\n');
    }
  } else if (options.weakest && options.weakest > 0) {
    const ids = graph.weakAssumptionsFirst.slice(0, options.weakest);
    views = ids.map((id) => graph.assumptions.find((v) => v.assumption.id === id)!).filter(Boolean);
  } else {
    views = graph.weakAssumptionsFirst
      .slice(0, 12)
      .map((id) => graph.assumptions.find((v) => v.assumption.id === id)!)
      .filter(Boolean);
  }

  lines.push('## Prioritized assumptions');
  lines.push('');

  for (const v of views) {
    const a = v.assumption;
    const kind = deriveAssumptionKind(a);
    lines.push(`### ${a.id} (${kind}, ${a.evidenceClass}, confidence ${a.confidence})`);
    lines.push('');
    lines.push(a.statement);
    lines.push('');
    if (v.supportedByTests.length > 0) {
      lines.push(`**Supported by tests:** ${v.supportedByTests.map((t) => `\`${t}\``).join(', ')}`);
    }
    if (v.missingEvidence.length > 0) {
      lines.push('**Missing evidence:**');
      for (const m of v.missingEvidence.slice(0, 5)) lines.push(`- ${m}`);
    }
    if (v.contradictions.length > 0) {
      lines.push('**Contradictions / challenges:**');
      for (const c of v.contradictions.slice(0, 3)) {
        lines.push(`- ${c.refLabel ?? c.refId} (${c.polarity})`);
      }
    }
    lines.push('');
  }

  const gaps = graph.testingGaps.filter((g) => g.priority === 'high' || g.priority === 'medium').slice(0, 10);
  if (gaps.length > 0) {
    lines.push('## Significant gaps (heuristic)');
    lines.push('');
    for (const g of gaps) {
      lines.push(`- \`${g.id}\` **${g.priority}** — ${g.reason}`);
      lines.push(`  - Related: ${g.relatedAssumptionIds.map((id) => `\`${id}\``).join(', ')}`);
      if (g.suggestedTestIdeas[0]) {
        lines.push(`  - Evidence that would help: ${g.suggestedTestIdeas[0]}`);
      }
    }
    lines.push('');
  }

  const thin = graph.explorationCoverage?.thinDimensions ?? graph.sfdotCoverage?.thinDimensions ?? [];
  if (thin.length > 0) {
    lines.push(`## Thin exploration dimensions: ${thin.join(', ')}`);
    lines.push('');
  }

  lines.push('## Suggested testing intents (not prescriptions)');
  lines.push('');
  lines.push(
    'Use these to **increase evidence** for weak or unknown assumptions. The coding agent chooses concrete tests and oracles.',
  );
  lines.push('');
  for (const w of graph.agentBrief.weakestAssumptions.slice(0, 8)) {
    lines.push(`- \`${w.id}\` (${w.claimPrecision}): ${w.gaps[0] ?? 'add direct assertion or scenario'}`);
  }
  lines.push('');

  lines.push('## Graph relations (sample)');
  lines.push('');
  for (const e of graph.edges.slice(0, 20)) {
    lines.push(`- \`${e.fromId}\` —${relationLabel(e.relation)}→ \`${e.toId}\``);
  }

  return lines.join('\n');
}

export function writeAgentContext(
  surpryzeDir: string,
  graph: AssumptionGraph,
  options: AgentContextOptions = {},
): string {
  const out = path.join(surpryzeDir, 'agent-context.md');
  fs.writeFileSync(out, buildAgentContextMarkdown(graph, options));
  return out;
}
