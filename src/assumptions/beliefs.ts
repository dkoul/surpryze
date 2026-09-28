import type { ParsedTest } from '../knowledge/schemas.js';

/**
 * Turn a parsed expect() chain into a human/agent-readable belief statement.
 */
export function assertionToBelief(expr: string, test: ParsedTest): string {
  const title = test.title;
  const matcher = expr.replace(/^expect\.?/, '').replace(/^expect/, '') || expr;

  if (matcher.includes('toBeVisible') || matcher.includes('toBeHidden')) {
    return `Expected UI visibility: ${title}`;
  }
  if (matcher.includes('toContainText') || matcher.includes('toHaveText')) {
    return `Expected UI text content: ${title}`;
  }
  if (matcher.includes('toHaveURL') || matcher.includes('toHaveTitle')) {
    return `Expected navigation/document state: ${title}`;
  }
  if (matcher.includes('toBeChecked') || matcher.includes('toBeEnabled') || matcher.includes('toBeDisabled')) {
    return `Expected control state: ${title}`;
  }
  if (matcher.includes('toHaveValue') || matcher.includes('toHaveAttribute')) {
    return `Expected element attribute/value: ${title}`;
  }
  if (matcher.includes('toHaveCount')) {
    return `Expected element count: ${title}`;
  }
  if (matcher.includes('toMatch') || matcher.includes('toEqual') || matcher.includes('toStrictEqual')) {
    return `Expected value equality: ${title}`;
  }
  if (matcher.includes('ok') || matcher.includes('toBeTruthy')) {
    return `Expected request/response success: ${title}`;
  }
  if (
    matcher.includes('toBe(400)') ||
    matcher.includes('toBe(404)') ||
    matcher.includes('toBe(403)') ||
    matcher.includes('toBeGreaterThanOrEqual(400)')
  ) {
    return `Expected HTTP or operation failure (4xx+): ${title}`;
  }
  if (matcher.includes('toBe(200)') || matcher.includes('toBe(201)')) {
    return `Expected HTTP success: ${title}`;
  }
  if (matcher.includes('not.')) {
    return `Expected negated condition: ${title} (${matcher})`;
  }

  return `Assertion: ${matcher} — ${title}`;
}

/** Every executed test encodes at least this belief (BDD oracle). */
export function titleToBelief(test: ParsedTest): string {
  return `Behavior under test: ${test.title}`;
}
