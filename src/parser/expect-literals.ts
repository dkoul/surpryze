import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { formatExpectChain } from './expect-chain.js';

export interface ParsedExpectOracle {
  expression: string;
  matcher: string;
  negated: boolean;
  subjectHint: string | null;
  /** Stringified literal / regex pattern values from the matcher arguments. */
  expectedLiterals: string[];
  hasDynamicExpected: boolean;
}

export function parseExpectAssertion(node: TSESTree.CallExpression): ParsedExpectOracle {
  const matcher = getMatcherName(node);
  const negated = matcher.startsWith('not.');
  const root = findExpectSubjectCall(node);
  const subjectHint = root ? formatSubjectNode(root.arguments[0]) : null;
  const { literals, dynamic } = extractMatcherLiterals(node, matcher);

  return {
    expression: formatExpectChain(node),
    matcher,
    negated,
    subjectHint,
    expectedLiterals: literals,
    hasDynamicExpected: dynamic,
  };
}

function getMatcherName(node: TSESTree.CallExpression): string {
  const parts: string[] = [];
  let cur: TSESTree.Node = node;
  while (cur.type === 'CallExpression' && cur.callee.type === 'MemberExpression') {
    const prop = cur.callee.property;
    if (prop.type === 'Identifier') {
      if (prop.name === 'not') {
        parts.unshift('not');
      } else {
        parts.unshift(prop.name);
      }
    }
    cur = cur.callee.object;
  }
  return parts.join('.');
}

function findExpectSubjectCall(node: TSESTree.CallExpression): TSESTree.CallExpression | null {
  let cur: TSESTree.Node = node;
  while (cur.type === 'CallExpression') {
    if (cur.callee.type === 'Identifier' && cur.callee.name === 'expect') {
      return cur;
    }
    if (cur.callee.type === 'MemberExpression' && cur.callee.object.type === 'CallExpression') {
      cur = cur.callee.object;
      continue;
    }
    break;
  }
  return null;
}

function extractMatcherLiterals(
  node: TSESTree.CallExpression,
  matcher: string,
): { literals: string[]; dynamic: boolean } {
  const literals: string[] = [];
  let dynamic = false;
  const cleanMatcher = matcher.replace(/^not\./, '');

  for (const arg of node.arguments) {
    const lit = literalFromNode(arg);
    if (lit !== null) literals.push(lit);
    else if (arg.type !== 'SpreadElement') dynamic = true;
  }

  // toBeVisible / ok() often have no args — not dynamic
  if (
    literals.length === 0 &&
    ['toBeVisible', 'toBeHidden', 'toBeTruthy', 'toBeFalsy', 'ok', 'toBeDefined', 'toBeUndefined'].some(
      (m) => cleanMatcher.includes(m),
    )
  ) {
    return { literals: [], dynamic: false };
  }

  if (literals.length === 0 && node.arguments.length > 0) {
    dynamic = true;
  }

  return { literals, dynamic };
}

function literalFromNode(node: TSESTree.Node): string | null {
  if (node.type === 'Literal') {
    if (typeof node.value === 'string') return JSON.stringify(node.value);
    return String(node.value);
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return JSON.stringify(node.quasis.map((q) => q.value.cooked ?? '').join(''));
  }
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal') {
    return String(-Number((node.argument as TSESTree.Literal).value));
  }
  return null;
}

function formatSubjectNode(node: TSESTree.Node | undefined): string | null {
  if (!node) return null;
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
    const chain: string[] = [];
    let cur: TSESTree.Node = node.callee;
    while (cur.type === 'MemberExpression') {
      if (cur.property.type === 'Identifier') chain.unshift(cur.property.name);
      cur = cur.object;
    }
    if (cur.type === 'Identifier') chain.unshift(cur.name);
    const args = node.arguments.map((a) => literalFromNode(a) ?? '?').join(', ');
    return `${chain.join('.')}(${args})`;
  }
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') {
    const parts: string[] = [];
    let cur: TSESTree.Node = node;
    while (cur.type === 'MemberExpression') {
      if (cur.property.type === 'Identifier') parts.unshift(cur.property.name);
      cur = cur.object;
    }
    if (cur.type === 'Identifier') parts.unshift(cur.name);
    return parts.join('.');
  }
  return null;
}
