import fs from 'node:fs';
import path from 'node:path';
import type { KnowledgeStore } from '../knowledge/store.js';
import { computeMetrics } from './metrics.js';

export function writeHtmlReport(store: KnowledgeStore, surpryzeDir: string): string {
  const m = computeMetrics(store);
  const surprises = store.listSurprises();
  const assumptions = store.listAssumptions();

  const surpriseRows = surprises
    .map(
      (s) =>
        `<tr><td>${s.id}</td><td>${s.feature ?? ''}</td><td>${escapeHtml(s.expected)}</td><td>${escapeHtml(s.observed)}</td><td>${s.status}</td><td>${Math.round(s.confidence * 100)}%</td></tr>`,
    )
    .join('\n');

  const gapList = m.topGaps.map((g, i) => `<li>${i + 1}. ${escapeHtml(g)}</li>`).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SURPRYZE REPORT</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #111; }
    h1 { letter-spacing: 0.05em; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #eee; padding: 0.5rem; text-align: left; vertical-align: top; }
    th { background: #f6f6f6; }
    .tagline { color: #555; }
  </style>
</head>
<body>
  <h1>SURPRYZE REPORT</h1>
  <p class="tagline">Turn surprise into knowledge.</p>
  <div class="metrics">
    <div class="card"><strong>Tests analyzed</strong><br/>${m.testsAnalyzed}</div>
    <div class="card"><strong>Assumptions discovered</strong><br/>${m.assumptionsDiscovered}</div>
    <div class="card"><strong>Assumptions challenged</strong><br/>${m.assumptionsChallenged}</div>
    <div class="card"><strong>Experiments run</strong><br/>${m.experimentsRun}</div>
    <div class="card"><strong>Surprises</strong><br/>${m.surprises}</div>
    <div class="card"><strong>Unexplained</strong><br/>${m.unexplained}</div>
    <div class="card"><strong>Potential defects</strong><br/>${m.potentialDefects}</div>
    <div class="card"><strong>Epistemic coverage</strong><br/>${m.epistemicCoverage}%</div>
  </div>
  <h2>Top knowledge gaps</h2>
  <ol>${gapList || '<li>None identified yet</li>'}</ol>
  <h2>Surprises</h2>
  <table>
    <thead><tr><th>ID</th><th>Feature</th><th>Expected</th><th>Observed</th><th>Status</th><th>Confidence</th></tr></thead>
    <tbody>${surpriseRows || '<tr><td colspan="6">No surprises recorded</td></tr>'}</tbody>
  </table>
  <h2>Assumption graph (flat)</h2>
  <ul>
    ${assumptions.map((a) => `<li><code>${a.id}</code> [${a.status}] ${escapeHtml(a.statement)}</li>`).join('\n')}
  </ul>
  <p><small>Generated ${new Date().toISOString()}</small></p>
</body>
</html>`;

  const out = path.join(surpryzeDir, 'report.html');
  fs.writeFileSync(out, html);
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
