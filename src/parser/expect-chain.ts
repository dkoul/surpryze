import type { TSESTree } from '@typescript-eslint/typescript-estree';

/** True if this call is part of a Playwright/Jest `expect(...).matcher()` chain. */
export function isExpectMatcherCall(node: TSESTree.CallExpression): boolean {
  return findExpectRootCall(node) !== null;
}

export function findExpectRootCall(node: TSESTree.CallExpression): TSESTree.CallExpression | null {
  let cur: TSESTree.Node = node;
  while (cur.type === 'CallExpression') {
    const callee: TSESTree.Expression = cur.callee;
    if (callee.type === 'Identifier' && callee.name === 'expect') {
      return cur;
    }
    if (callee.type === 'MemberExpression') {
      if (callee.object.type === 'CallExpression') {
        cur = callee.object;
        continue;
      }
      if (callee.object.type === 'Identifier' && callee.object.name === 'expect') {
        return cur;
      }
    }
    break;
  }
  return null;
}

/** Outermost matcher in the chain (e.g. expect(x).toBe.yes → full chain string). */
export function formatExpectChain(outerMatcher: TSESTree.CallExpression): string {
  const parts: string[] = ['expect'];
  const subject = outerMatcher.arguments[0];
  if (subject) {
    parts.push('(', formatSubject(subject), ')');
  }
  let cur: TSESTree.CallExpression = outerMatcher;
  while (cur.callee.type === 'MemberExpression') {
    const prop = cur.callee.property;
    if (prop.type === 'Identifier') {
      parts.push('.', prop.name);
    }
    const inner = cur.callee.object;
    if (inner.type === 'CallExpression' && inner.callee.type === 'Identifier' && inner.callee.name === 'expect') {
      break;
    }
    if (inner.type === 'CallExpression') {
      cur = inner;
    } else {
      break;
    }
  }
  // Walk forward from root for chained matchers
  const root = findExpectRootCall(outerMatcher);
  if (!root) return parts.join('');
  const matchers: string[] = [];
  let n: TSESTree.Node = root;
  while (n.type === 'CallExpression') {
    if (n.callee.type === 'MemberExpression' && n.callee.property.type === 'Identifier') {
      matchers.push(n.callee.property.name);
      n = n.callee.object;
      continue;
    }
    if (n.callee.type === 'Identifier' && n.callee.name === 'expect') {
      break;
    }
    break;
  }
  if (matchers.length > 0) {
    return 'expect' + matchers.reverse().map((m) => `.${m}`).join('');
  }
  return extractExpectLegacy(outerMatcher);
}

function extractExpectLegacy(call: TSESTree.CallExpression): string {
  const parts: string[] = ['expect'];
  let cur: TSESTree.Node = call;
  while (cur.type === 'CallExpression') {
    if (cur.callee.type === 'MemberExpression' && cur.callee.property.type === 'Identifier') {
      parts.push(cur.callee.property.name);
    }
    if (cur.callee.type === 'MemberExpression' && cur.callee.object.type === 'CallExpression') {
      cur = cur.callee.object;
    } else break;
  }
  return parts.join('.');
}

function formatSubject(node: TSESTree.Node): string {
  if (node.type === 'MemberExpression') {
    const parts: string[] = [];
    let cur: TSESTree.Node = node;
    while (cur.type === 'MemberExpression') {
      if (cur.property.type === 'Identifier') parts.unshift(cur.property.name);
      cur = cur.object;
    }
    if (cur.type === 'Identifier') parts.unshift(cur.name);
    return parts.join('.') || 'value';
  }
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
    return formatSubject(node.callee);
  }
  return 'value';
}
