import fs from 'node:fs';
import path from 'node:path';
import type { AssumptionGraph } from '../knowledge/schemas.js';
import { deriveAssumptionKind } from '../assumptions/kind.js';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function writeAssumptionGraphHtml(graph: AssumptionGraph, surpryzeDir: string): string {
  const exploration = graph.explorationCoverage ?? graph.sfdotCoverage;
  const dimRows =
    'dimensions' in exploration
      ? exploration.dimensions.map(
          (d) =>
            `<tr><td>${escapeHtml(d.label)}</td><td>${d.strength}</td><td>${d.testsWithSignal}/${d.testsTotal}</td><td>${escapeHtml(d.description)}</td></tr>`,
        )
      : [];

  const assumptionRows = graph.assumptions
    .slice(0, 80)
    .map((v) => {
      const kind = v.assumptionKind ?? deriveAssumptionKind(v.assumption);
      return `<tr><td><code>${v.assumption.id}</code></td><td>${kind}</td><td>${v.assumption.evidenceClass}</td><td>${Math.round(v.assumption.confidence * 100)}%</td><td>${escapeHtml(v.assumption.statement)}</td></tr>`;
    })
    .join('\n');

  const gapRows = graph.testingGaps
    .slice(0, 25)
    .map(
      (g) =>
        `<tr><td><code>${g.id}</code></td><td>${g.priority}</td><td>${escapeHtml(g.reason)}</td><td>${g.relatedAssumptionIds.map((id) => `<code>${id}</code>`).join(', ')}</td></tr>`,
    )
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Surpryze — Assumption Graph Report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #111; max-width: 1100px; }
    h1 { font-size: 1.5rem; }
    .muted { color: #555; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.9rem; }
    th, td { border: 1px solid #eee; padding: 0.45rem; text-align: left; vertical-align: top; }
    th { background: #f6f6f6; }
    .callout { background: #f9f9f6; border-left: 4px solid #ccc; padding: 0.75rem 1rem; margin: 1rem 0; }
  </style>
</head>
<body>
  <h1>Surpryze Assumption Graph</h1>
  <p class="muted">What the test suite believes, evidence strength, and remaining uncertainty.</p>
  <div class="callout">${escapeHtml(graph.coverageDisclaimer)}</div>
  <p><strong>Tests analyzed:</strong> ${graph.projectSummary.testsAnalyzed} ·
     <strong>Assumptions:</strong> ${graph.projectSummary.assumptions} ·
     <strong>Gaps (heuristic):</strong> ${graph.projectSummary.testingGaps}</p>
  <p class="muted">${escapeHtml(graph.agentBrief.fidelityNote)}</p>
  <h2>Exploration dimensions</h2>
  <table>
    <thead><tr><th>Dimension</th><th>Strength</th><th>Tests</th><th>Description</th></tr></thead>
    <tbody>${dimRows.join('\n') || '<tr><td colspan="4">No data</td></tr>'}</tbody>
  </table>
  <h2>Assumptions</h2>
  <table>
    <thead><tr><th>ID</th><th>Kind</th><th>Evidence</th><th>Confidence</th><th>Statement</th></tr></thead>
    <tbody>${assumptionRows}</tbody>
  </table>
  <h2>Gaps</h2>
  <table>
    <thead><tr><th>ID</th><th>Priority</th><th>Reason</th><th>Related assumptions</th></tr></thead>
    <tbody>${gapRows || '<tr><td colspan="4">None</td></tr>'}</tbody>
  </table>
  <p class="muted"><small>Generated ${graph.generatedAt}. Agent context: <code>agent-context.md</code> · Machine graph: <code>graph.json</code></small></p>
</body>
</html>`;

  const out = path.join(surpryzeDir, 'report.html');
  fs.writeFileSync(out, html);
  return out;
}
