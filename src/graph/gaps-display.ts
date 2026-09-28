import type { AssumptionGraph } from '../knowledge/schemas.js';

export function formatGapsReport(graph: AssumptionGraph): string {
  const lines: string[] = [];
  lines.push('SURPRYZE — ASSUMPTIONS & TEST GAPS');
  lines.push('==================================');
  lines.push('');
  lines.push('## Assumptions you are making');
  lines.push('');
  lines.push(
    `The suite encodes ${graph.assumptionsSummary.totalClaims} claims (${graph.assumptionsSummary.literalClaims} literal, ${graph.assumptionsSummary.structuralClaims} structural, ${graph.assumptionsSummary.intentClaims} intent-only).`,
  );
  lines.push('');

  for (const [feature, stats] of Object.entries(graph.assumptionsSummary.byFeature).sort()) {
    lines.push(
      `  • ${feature}: ${stats.tests} tests → ${stats.assumptions} claims (${stats.literalAssumptions} literal)`,
    );
  }

  lines.push('');
  lines.push('Key beliefs (from assertions and structure, not production proof):');
  for (const h of graph.assumptionsSummary.highlightedAssumptions.slice(0, 12)) {
    lines.push(`  - [${h.claimPrecision}/${h.evidenceClass}] ${h.statement}`);
  }

  lines.push('');
  lines.push('## Where you should write tests');
  lines.push('');

  if (graph.testingGaps.length === 0) {
    lines.push('  No high-priority gaps detected (or run `surpryze learn` to refresh).');
  } else {
    for (const g of graph.testingGaps.slice(0, 15)) {
      lines.push('');
      lines.push(`[${g.priority.toUpperCase()}] ${g.id} (${g.category})`);
      if (g.feature) lines.push(`  Feature: ${g.feature}`);
      lines.push(`  ${g.reason}`);
      lines.push('  Suggested:');
      for (const idea of g.suggestedTestIdeas.slice(0, 3)) {
        lines.push(`    - ${idea}`);
      }
    }
  }

  lines.push('');
  lines.push(graph.agentBrief.fidelityNote);
  return lines.join('\n');
}
