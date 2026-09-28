import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import type { ParsedTest } from '../knowledge/schemas.js';
import { createHash } from 'node:crypto';

function hashId(parts: string[]): string {
  return 'T-' + createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 8);
}

function collectCalls(
  node: TSESTree.Node,
  actions: string[],
  assertions: string[],
  routes: string[],
  apiCalls: string[],
  assertionDetails: { id: string; expression: string; line?: number }[],
  testId: string,
  assertionIndex: { n: number },
): void {
  if (node.type === 'CallExpression') {
    const callee = node.callee;
    let name = '';
    if (callee.type === 'Identifier') name = callee.name;
    if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
      name = callee.property.name;
      if (callee.object.type === 'Identifier') {
        const obj = callee.object.name;
        if (['page', 'context', 'request'].includes(obj)) {
          if (['goto', 'click', 'fill', 'press', 'check', 'uncheck', 'selectOption'].includes(name)) {
            actions.push(`${obj}.${name}`);
          }
          if (name === 'goto' && node.arguments[0]?.type === 'Literal') {
            routes.push(String((node.arguments[0] as TSESTree.Literal).value));
          }
        }
        if (obj === 'expect') {
          const expr = extractExpect(node);
          assertions.push(expr);
          const line = node.loc?.start.line;
          const aid = `AS-${testId}-${assertionIndex.n++}`;
          assertionDetails.push({ id: aid, expression: expr, line });
        }
      }
    }
    if (name === 'fetch' || (callee.type === 'MemberExpression' && name === 'post')) {
      apiCalls.push('api_call');
    }
  }
  for (const key of Object.keys(node) as (keyof TSESTree.Node)[]) {
    const child = node[key];
    if (!child) continue;
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c === 'object' && 'type' in c) {
          collectCalls(c as TSESTree.Node, actions, assertions, routes, apiCalls, assertionDetails, testId, assertionIndex);
        }
      }
    } else if (typeof child === 'object' && child !== null && 'type' in child) {
      collectCalls(child as TSESTree.Node, actions, assertions, routes, apiCalls, assertionDetails, testId, assertionIndex);
    }
  }
}

function extractExpect(call: TSESTree.CallExpression): string {
  const parts: string[] = ['expect'];
  if (call.arguments.length > 0) {
    const arg = call.arguments[0];
    if (arg.type === 'MemberExpression' && arg.property.type === 'Identifier') {
      parts.push(arg.property.name);
    }
  }
  let cur: TSESTree.Node = call;
  while (cur.type === 'CallExpression') {
    if (cur.callee.type === 'MemberExpression' && cur.callee.property.type === 'Identifier') {
      parts.push(cur.callee.property.name);
    }
    if (
      cur.callee.type === 'MemberExpression' &&
      cur.callee.object.type === 'CallExpression'
    ) {
      cur = cur.callee.object;
    } else break;
  }
  return parts.join('.');
}

function inferFeature(filePath: string, describePath: string[]): string | undefined {
  const base = path.basename(filePath).replace(/\.(spec|test)\.[tj]s$/, '');
  if (describePath.length > 0) {
    const top = describePath[0].toLowerCase();
    if (top.includes('password') || top.includes('reset')) return 'password_reset';
    return top.replace(/\s+/g, '_').slice(0, 64);
  }
  if (base.includes('reset') || base.includes('password')) return 'password_reset';
  return base.replace(/-/g, '_');
}

export function parsePlaywrightFile(filePath: string, projectRoot: string): ParsedTest[] {
  const source = fs.readFileSync(filePath, 'utf8');
  let ast: TSESTree.Program;
  try {
    ast = parse(source, {
      loc: true,
      range: true,
      jsx: false,
      errorOnUnknownASTType: false,
    }) as TSESTree.Program;
  } catch {
    return [];
  }

  const tests: ParsedTest[] = [];
  const rel = path.relative(projectRoot, filePath);

  function walkDescribe(node: TSESTree.Node, describePath: string[]): void {
    if (node.type === 'CallExpression') {
      const fn = getSuiteCallName(node);
      if (fn === 'describe' || fn === 'test' || fn === 'it') {
        const title = getStringArg(node.arguments[0]);
        if (!title) return;
        const body = node.arguments[node.arguments.length - 1];
        if (fn === 'describe' && (body?.type === 'ArrowFunctionExpression' || body?.type === 'FunctionExpression')) {
          const block = body.body;
          walkDescribeBody(block, [...describePath, title]);
          return;
        }
        if ((fn === 'test' || fn === 'it') && (body?.type === 'ArrowFunctionExpression' || body?.type === 'FunctionExpression')) {
          const actions: string[] = [];
          const assertions: string[] = [];
          const assertionDetails: { id: string; expression: string; line?: number }[] = [];
          const routes: string[] = [];
          const apiCalls: string[] = [];
          const fullTitle = [...describePath, title].join(' > ');
          const id = hashId([rel, fullTitle]);
          collectCalls(body, actions, assertions, routes, apiCalls, assertionDetails, id, { n: 0 });
          tests.push({
            id,
            filePath: rel,
            title: fullTitle,
            feature: inferFeature(filePath, describePath),
            describePath,
            actions: [...new Set(actions)],
            assertions: [...new Set(assertions)],
            assertionDetails,
            routes: [...new Set(routes)],
            apiCalls: [...new Set(apiCalls)],
          });
        }
      }
    }
    for (const key of Object.keys(node) as (keyof TSESTree.Node)[]) {
      const child = node[key];
      if (!child) continue;
      if (Array.isArray(child)) {
        for (const c of child) {
          if (c && typeof c === 'object' && 'type' in c) walkDescribe(c as TSESTree.Node, describePath);
        }
      } else if (typeof child === 'object' && child !== null && 'type' in child) {
        walkDescribe(child as TSESTree.Node, describePath);
      }
    }
  }

  function walkDescribeBody(body: TSESTree.Statement | TSESTree.Expression, describePath: string[]): void {
    if (body.type === 'BlockStatement') {
      for (const stmt of body.body) walkDescribe(stmt, describePath);
    }
  }

  for (const stmt of ast.body) walkDescribe(stmt, []);
  return tests;
}

function getSuiteCallName(call: TSESTree.CallExpression): string | null {
  if (call.callee.type === 'Identifier') {
    const n = call.callee.name;
    if (n === 'describe' || n === 'test' || n === 'it') return n;
    return null;
  }
  if (
    call.callee.type === 'MemberExpression' &&
    call.callee.property.type === 'Identifier'
  ) {
    const prop = call.callee.property.name;
    if (prop === 'describe' || prop === 'test' || prop === 'it') return prop;
  }
  return null;
}

function getStringArg(node: TSESTree.Expression | TSESTree.SpreadElement | undefined): string | null {
  if (!node || node.type === 'SpreadElement') return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((q) => q.value.cooked ?? '').join('');
  }
  if (node.type === 'TemplateLiteral') {
    return node.quasis.map((q) => q.value.cooked ?? '').join('*');
  }
  return null;
}

export function parseAllTestFiles(files: string[], projectRoot: string): ParsedTest[] {
  return files.flatMap((f) => parsePlaywrightFile(f, projectRoot));
}
