import type { AssumptionGraph } from '../knowledge/schemas.js';

export function formatGraphReport(graph: AssumptionGraph): string {
  const lines: string[] = [];
  lines.push('SURPRYZE ASSUMPTION GRAPH');
  lines.push('=========================');
  lines.push('');
  lines.push(`Tests analyzed: ${graph.projectSummary.testsAnalyzed}`);
  lines.push(`Assumptions:    ${graph.projectSummary.assumptions}`);
  lines.push(`Graph edges:    ${graph.projectSummary.edges}`);
  lines.push('');
  lines.push('AGENT BRIEF');
  lines.push(`  What:  ${graph.agentBrief.whatTestsBelieve}`);
  lines.push(`  Why:   ${graph.agentBrief.whyTheyBelieveIt}`);
  lines.push('');
  lines.push('WEAKEST ASSUMPTIONS FIRST');
  lines.push('---------------------------');

  for (const id of graph.weakAssumptionsFirst) {
    const view = graph.assumptions.find((a) => a.assumption.id === id);
    if (!view) continue;
    const a = view.assumption;
    lines.push('');
    lines.push(
      `${a.id} [${a.evidenceClass}] precision=${a.claimPrecision} confidence=${a.confidence} status=${a.status}`,
    );
    lines.push(`  Statement: ${a.statement}`);
    if (a.expectedLiterals.length > 0) {
      lines.push(`  Expected values: ${a.expectedLiterals.join(', ')}`);
    }
    lines.push(`  Source:    ${a.source}`);
    if (view.supportedByTests.length > 0) {
      lines.push(`  Tests:     ${view.supportedByTests.join(', ')}`);
    }
    const supporting = view.evidence.filter((e) => e.polarity === 'supports' && e.evidenceKind !== 'missing');
    if (supporting.length > 0) {
      lines.push('  Supporting evidence:');
      for (const e of supporting) {
        lines.push(
          `    - [${e.evidenceKind}] ${e.refKind}:${e.refId}${e.refLabel ? ` — ${e.refLabel}` : ''}`,
        );
      }
    }
    if (view.contradictions.length > 0) {
      lines.push('  Contradictions (explicit):');
      for (const c of view.contradictions) {
        lines.push(`    - contradicts ${c.refKind}:${c.refId} (${c.refLabel ?? ''})`);
      }
    }
    if (view.missingEvidence.length > 0 || view.plausibleUntestedScenarios.length > 0) {
      lines.push('  Missing / untested:');
      for (const m of view.missingEvidence) lines.push(`    - ${m}`);
      for (const s of view.plausibleUntestedScenarios) lines.push(`    - scenario: ${s}`);
    }
  }

  lines.push('');
  lines.push(`Note: ${graph.agentBrief.fidelityNote}`);
  lines.push('');
  lines.push(`Full graph JSON: graph.json (${graph.generatedAt})`);
  return lines.join('\n');
}
