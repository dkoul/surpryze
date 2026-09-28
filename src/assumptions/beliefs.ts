import type { ParsedAssertion, ParsedTest } from '../knowledge/schemas.js';
import type { ClaimPrecision } from '../knowledge/schemas.js';

export interface BeliefStatement {
  statement: string;
  precision: ClaimPrecision;
  /** When literals were extracted from the assertion. */
  expectedLiterals: string[];
}

/**
 * Turn a parsed expect() oracle into a precise claim when literals are available.
 */
export function assertionToBelief(detail: ParsedAssertion, test: ParsedTest): BeliefStatement {
  const matcher = detail.matcher ?? detail.expression;
  const clean = matcher.replace(/^not\./, '');
  const neg = detail.negated ? 'not ' : '';
  const subject = detail.subjectHint ? ` (${detail.subjectHint})` : '';
  const lits = detail.expectedLiterals ?? [];
  const litList = lits.length > 0 ? lits.join(', ') : null;

  if (detail.hasDynamicExpected) {
    return {
      statement: `Assertion ${matcher}${subject} uses a non-literal expected value — ${test.title}`,
      precision: 'structural',
      expectedLiterals: [],
    };
  }

  if (clean.includes('toHaveText') || clean.includes('toContainText')) {
    if (litList) {
      return {
        statement: `UI${subject} should ${neg}contain text ${litList}`,
        precision: 'literal',
        expectedLiterals: lits,
      };
    }
    return {
      statement: `UI${subject} should ${neg}match expected text (value not statically extractable)`,
      precision: 'structural',
      expectedLiterals: [],
    };
  }

  if (clean.includes('toHaveURL')) {
    if (litList) {
      return {
        statement: `Page URL should ${neg}be ${litList}`,
        precision: 'literal',
        expectedLiterals: lits,
      };
    }
    return { statement: `Page should ${neg}have expected URL — ${test.title}`, precision: 'structural', expectedLiterals: [] };
  }

  if (clean.includes('toHaveTitle')) {
    if (litList) {
      return { statement: `Document title should ${neg}be ${litList}`, precision: 'literal', expectedLiterals: lits };
    }
    return { statement: `Document should ${neg}have expected title — ${test.title}`, precision: 'structural', expectedLiterals: [] };
  }

  if (clean === 'toBeVisible' || clean === 'toBeHidden') {
    return {
      statement: `UI${subject} should ${neg}be ${clean === 'toBeVisible' ? 'visible' : 'hidden'}`,
      precision: 'structural',
      expectedLiterals: [],
    };
  }

  if (clean.includes('toHaveValue')) {
    if (litList) {
      return { statement: `Input${subject} should ${neg}have value ${litList}`, precision: 'literal', expectedLiterals: lits };
    }
    return { statement: `Input${subject} should ${neg}have expected value — ${test.title}`, precision: 'structural', expectedLiterals: [] };
  }

  if (clean.includes('toHaveCount')) {
    if (litList) {
      return { statement: `Locator${subject} should ${neg}have count ${litList}`, precision: 'literal', expectedLiterals: lits };
    }
    return { statement: `Expected element count — ${test.title}`, precision: 'structural', expectedLiterals: [] };
  }

  if (clean.includes('toHaveAttribute')) {
    if (lits.length >= 2) {
      return {
        statement: `Element${subject} should ${neg}have attribute ${lits[0]}=${lits[1]}`,
        precision: 'literal',
        expectedLiterals: lits,
      };
    }
    if (litList) {
      return { statement: `Element${subject} should ${neg}have attribute ${litList}`, precision: 'literal', expectedLiterals: lits };
    }
    return { statement: `Expected attribute on element${subject} — ${test.title}`, precision: 'structural', expectedLiterals: [] };
  }

  if (clean === 'ok' || clean === 'toBeTruthy') {
    return {
      statement: `HTTP/API response should ${neg}succeed (2xx) — ${test.title}`,
      precision: 'structural',
      expectedLiterals: [],
    };
  }

  if (clean === 'toBe' || clean === 'toEqual' || clean === 'toStrictEqual') {
    if (litList) {
      return {
        statement: `Value should ${neg}equal ${litList} — ${test.title}`,
        precision: 'literal',
        expectedLiterals: lits,
      };
    }
  }

  if (clean.includes('toBeGreaterThanOrEqual') && litList) {
    return {
      statement: `Numeric status/code should be >= ${litList} — ${test.title}`,
      precision: 'literal',
      expectedLiterals: lits,
    };
  }

  if (lits.length > 0) {
    return {
      statement: `${matcher}${subject}: expected ${litList} — ${test.title}`,
      precision: 'literal',
      expectedLiterals: lits,
    };
  }

  return {
    statement: `Assertion ${matcher}${subject} — ${test.title}`,
    precision: 'structural',
    expectedLiterals: [],
  };
}

/** Title encodes intent only; not a verified outcome. */
export function titleToBelief(test: ParsedTest): BeliefStatement {
  return {
    statement: `[Intent] Test scenario: ${test.title}`,
    precision: 'intent',
    expectedLiterals: [],
  };
}

export function precisionEvidenceWeight(precision: ClaimPrecision): number {
  switch (precision) {
    case 'literal':
      return 0.72;
    case 'structural':
      return 0.38;
    case 'intent':
      return 0.12;
  }
}
