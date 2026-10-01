import fs from 'node:fs';
import { parse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { createHash } from 'node:crypto';
import type { CoverageLens } from '../heuristics/coverage-lenses.js';
import { inferLensFromSignals } from '../heuristics/coverage-lenses.js';

export interface ReactCodeSignal {
  id: string;
  filePath: string;
  line?: number;
  kind: 'route' | 'api' | 'form' | 'navigation' | 'component' | 'handler' | 'state';
  label: string;
  signals: string[];
}

export interface AppAssumptionCandidate {
  statement: string;
  feature?: string;
  lens: CoverageLens;
  signals: ReactCodeSignal[];
}

function signalId(filePath: string, kind: string, label: string): string {
  return (
    'RS-' +
    createHash('sha256').update(`${filePath}|${kind}|${label}`).digest('hex').slice(0, 8)
  );
}

function stableAssumptionId(statement: string): string {
  return 'A-' + createHash('sha256').update(statement.trim().toLowerCase()).digest('hex').slice(0, 8);
}

function literalArg(node: TSESTree.CallExpression, index = 0): string | undefined {
  const arg = node.arguments[index];
  if (arg?.type === 'Literal' && typeof arg.value === 'string') return arg.value;
  return undefined;
}

function walk(node: TSESTree.Node, filePath: string, out: ReactCodeSignal[]): void {
  if (node.type === 'CallExpression') {
    const callee = node.callee;
    let name = '';
    let obj = '';
    if (callee.type === 'Identifier') name = callee.name;
    if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
      name = callee.property.name;
      if (callee.object.type === 'Identifier') obj = callee.object.name;
    }
    if (name === 'fetch') {
      const url = literalArg(node);
      out.push({
        id: signalId(filePath, 'api', url ?? 'fetch'),
        filePath,
        line: node.loc?.start.line,
        kind: 'api',
        label: url ?? 'fetch(...)',
        signals: ['fetch', 'api', url ?? ''],
      });
    }
    if (obj === 'axios' || name === 'get' || name === 'post' || name === 'put' || name === 'delete') {
      const url = literalArg(node);
      if (url?.startsWith('/') || url?.includes('api')) {
        out.push({
          id: signalId(filePath, 'api', url),
          filePath,
          line: node.loc?.start.line,
          kind: 'api',
          label: `${obj || 'http'}.${name} ${url}`,
          signals: ['api', name, url],
        });
      }
    }
  }

  if (node.type === 'JSXOpeningElement' && node.name.type === 'JSXIdentifier') {
    const tag = node.name.name;
    if (['form', 'Form'].includes(tag)) {
      out.push({
        id: signalId(filePath, 'form', tag),
        filePath,
        line: node.loc?.start.line,
        kind: 'form',
        label: `<${tag}>`,
        signals: ['form', 'interaction'],
      });
    }
    if (['Link', 'NavLink', 'Route'].includes(tag)) {
      const pathAttr = node.attributes.find(
        (a) =>
          a.type === 'JSXAttribute' &&
          a.name.type === 'JSXIdentifier' &&
          (a.name.name === 'to' || a.name.name === 'path') &&
          a.value?.type === 'Literal',
      ) as TSESTree.JSXAttribute | undefined;
      const routePath =
        pathAttr?.value?.type === 'Literal' ? String(pathAttr.value.value) : tag;
      out.push({
        id: signalId(filePath, 'route', routePath),
        filePath,
        line: node.loc?.start.line,
        kind: 'route',
        label: `${tag} ${routePath}`,
        signals: ['route', 'structure', routePath],
      });
    }
  }

  for (const key of Object.keys(node) as (keyof TSESTree.Node)[]) {
    const child = node[key];
    if (!child) continue;
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c === 'object' && 'type' in c) walk(c as TSESTree.Node, filePath, out);
      }
    } else if (typeof child === 'object' && child && 'type' in child) {
      walk(child as TSESTree.Node, filePath, out);
    }
  }
}

export function scanReactFile(filePath: string): ReactCodeSignal[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const out: ReactCodeSignal[] = [];
  try {
    const ast = parse(content, {
      loc: true,
      range: false,
      jsx: true,
      ecmaVersion: 'latest',
      sourceType: 'module',
    });
    walk(ast, filePath, out);
  } catch {
    if (/path:\s*['"]([^'"]+)['"]/.test(content)) {
      const m = content.match(/path:\s*['"]([^'"]+)['"]/g);
      for (const hit of m ?? []) {
        out.push({
          id: signalId(filePath, 'route', hit),
          filePath,
          kind: 'route',
          label: hit,
          signals: ['route', 'structure'],
        });
      }
    }
  }

  const componentName = filePath.split('/').pop()?.replace(/\.(tsx|jsx)$/, '') ?? 'Component';
  if (/export\s+(default\s+)?function\s+\w+/.test(content) || /export\s+const\s+\w+\s*=/.test(content)) {
    out.push({
      id: signalId(filePath, 'component', componentName),
      filePath,
      kind: 'component',
      label: componentName,
      signals: ['component', 'structure', componentName],
    });
  }

  return out;
}

export function scanReactProject(sourceFiles: string[]): {
  signals: ReactCodeSignal[];
  candidates: AppAssumptionCandidate[];
} {
  const signals: ReactCodeSignal[] = [];
  for (const f of sourceFiles) {
    signals.push(...scanReactFile(f));
  }

  const byRoute = signals.filter((s) => s.kind === 'route');
  const byApi = signals.filter((s) => s.kind === 'api');
  const byForm = signals.filter((s) => s.kind === 'form');
  const candidates: AppAssumptionCandidate[] = [];

  for (const r of byRoute) {
    const pathLabel = r.label.replace(/^Route\s+/, '').replace(/^Link\s+/, '');
    candidates.push({
      statement: `The application exposes route or navigation target: ${pathLabel}`,
      feature: 'routing',
      lens: 'structure',
      signals: [r],
    });
  }

  for (const a of byApi) {
    candidates.push({
      statement: `The application calls backend endpoint: ${a.label}`,
      feature: 'api',
      lens: 'platform',
      signals: [a],
    });
  }

  for (const f of byForm) {
    candidates.push({
      statement: `The application provides a form interaction at ${f.label} in ${f.filePath.split('/').pop()}`,
      feature: 'forms',
      lens: 'interaction',
      signals: [f],
    });
  }

  const components = signals.filter((s) => s.kind === 'component');
  if (components.length > 0) {
    const grouped = new Map<string, ReactCodeSignal[]>();
    for (const c of components) {
      const feat = c.label;
      const list = grouped.get(feat) ?? [];
      list.push(c);
      grouped.set(feat, list);
    }
    for (const [name, sigs] of grouped) {
      const lens = inferLensFromSignals(sigs.flatMap((s) => s.signals));
      candidates.push({
        statement: `The application includes UI surface "${name}" with user-facing behavior implied by its implementation`,
        feature: name,
        lens,
        signals: sigs,
      });
    }
  }

  const deduped = new Map<string, AppAssumptionCandidate>();
  for (const c of candidates) {
    const id = stableAssumptionId(c.statement);
    if (!deduped.has(id)) deduped.set(id, c);
  }

  return { signals, candidates: [...deduped.values()] };
}

export { stableAssumptionId as appAssumptionId };
