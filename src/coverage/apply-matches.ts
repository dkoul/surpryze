import { createHash } from 'node:crypto';
import type { CoverageMatch, CoverageMatchesFile } from './match-schema.js';
import type { KnowledgeStore } from '../knowledge/store.js';
import { classifyEvidence, deriveConfidenceFromEvidence } from '../assumptions/confidence.js';
import type { AssumptionEvidence } from '../knowledge/schemas.js';
import { CoverageMatchesFileSchema } from './match-schema.js';
import fs from 'node:fs';

function evidenceId(assumptionId: string, testId: string): string {
  return (
    'EV-' +
    createHash('sha256').update(`${assumptionId}|${testId}|test-support`).digest('hex').slice(0, 8)
  );
}

const strengthWeight: Record<CoverageMatch['matchStrength'], number> = {
  strong: 0.75,
  moderate: 0.5,
  weak: 0.28,
  none: 0,
};

export function loadCoverageMatches(filePath: string): CoverageMatchesFile {
  return CoverageMatchesFileSchema.parse(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

export function applyCoverageMatches(store: KnowledgeStore, file: CoverageMatchesFile): number {
  let links = 0;
  for (const m of file.matches) {
    const assumption = store.getAssumption(m.assumptionId);
    if (!assumption) continue;

    const newEvidence: AssumptionEvidence[] = [];
    for (const testId of m.testIds) {
      if (m.matchStrength === 'none') continue;
      newEvidence.push({
        id: evidenceId(m.assumptionId, testId),
        assumptionId: m.assumptionId,
        refKind: 'test',
        refId: testId,
        refLabel: `UI test coverage (${m.matchStrength}): ${m.rationale.slice(0, 120)}`,
        evidenceKind: m.matchStrength === 'strong' ? 'direct' : 'indirect',
        polarity: 'supports',
        weight: strengthWeight[m.matchStrength],
      });
      links++;
    }

    for (const ev of newEvidence) {
      store.upsertAssumptionEvidence(ev);
    }

    const allEvidence = store.listAssumptionEvidence().filter((e) => e.assumptionId === assumption.id);
    const contradictions = allEvidence.filter((e) => e.polarity === 'contradicts');
    const confidence = deriveConfidenceFromEvidence(allEvidence);
    const evidenceClass = classifyEvidence(
      allEvidence,
      contradictions.length > 0,
      assumption.claimPrecision,
    );

    let missingScenarios = [...assumption.missingScenarios];
    if (m.matchStrength === 'none' || m.testIds.length === 0) {
      if (m.gapNote && !missingScenarios.includes(m.gapNote)) {
        missingScenarios.push(m.gapNote);
      } else if (!missingScenarios.length) {
        missingScenarios.push('No UI test semantically covers this application assumption');
      }
    }

    store.upsertAssumption({
      ...assumption,
      confidence,
      evidenceClass,
      status: newEvidence.length > 0 ? 'TESTED' : assumption.status,
      missingScenarios,
      updatedAt: new Date().toISOString(),
    });
  }

  store.setMeta('coverageMatchAt', file.generatedAt);
  store.setMeta('uiTestsRoot', file.uiTestsRoot);
  store.setMeta('graphOrigin', 'merged');

  return links;
}
