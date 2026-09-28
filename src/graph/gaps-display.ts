import type { AssumptionGraph } from '../knowledge/schemas.js';

export function formatGapsReport(graph: AssumptionGraph): string {
  const lines: string[] = [];
  lines.push('SURPRYZE — ASSUMPTIONS & TEST GAPS');
  lines.push('==================================');
  lines.push('');
  lines.push(graph.coverageDisclaimer);
  lines.push('');
  lines.push('## Assumptions you are making');
  lines.push('');
  lines.push(
    `The suite encodes ${graph.assumptionsSummary.totalClaims} claims (${graph.assumptionsSummary.literalClaims} literal, ${graph.assumptionsSummary.structuralClaims} structural, ${graph.assumptionsSummary.intentClaims} intent-only).`,
  );
  lines.push(
    'Literal = values from source; structural = matcher type only; intent = title/scenario text only.',
  );
  lines.push('');

  for (const [feature, stats] of Object.entries(graph.assumptionsSummary.byFeature).sort()) {
    lines.push(
      `  • ${feature}: ${stats.tests} tests → ${stats.assumptions} claims (${stats.literalAssumptions} literal)`,
    );
  }

  lines.push('');
  lines.push('Key beliefs (from test source — not proof of production behavior):');
  for (const h of graph.assumptionsSummary.highlightedAssumptions.slice(0, 12)) {
    lines.push(`  - [${h.claimPrecision}/${h.evidenceClass}] ${h.statement}`);
  }

  lines.push('');
  lines.push(`## Where you should write tests (${graph.testingGaps.length} findings)`);
  lines.push('');

  const shown = graph.testingGaps.slice(0, 20);
  for (const g of shown) {
    lines.push('');
    lines.push(`[${g.priority.toUpperCase()}] ${g.id} (${g.category})`);
    if (g.feature) lines.push(`  Feature: ${g.feature}`);
    lines.push(`  ${g.reason}`);
    lines.push('  Suggested:');
    for (const idea of g.suggestedTestIdeas.slice(0, 3)) {
      lines.push(`    - ${idea}`);
    }
  }

  if (graph.testingGaps.length > shown.length) {
    lines.push('');
    lines.push(`  … and ${graph.testingGaps.length - shown.length} more (see testing-gaps.json)`);
  }

  lines.push('');
  lines.push(graph.agentBrief.fidelityNote);
  return lines.join('\n');
}
