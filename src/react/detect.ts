import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

export interface ReactProjectInfo {
  root: string;
  packageJson: string;
  sourceDirs: string[];
  sourceFiles: string[];
  hasReactRouter: boolean;
}

export function detectReactProject(root: string, sourceDirs?: string[]): ReactProjectInfo | null {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!deps.react && !deps['react-dom']) return null;

  const dirs =
    sourceDirs ??
    ['src', 'app', 'pages', 'components'].filter((d) => fs.existsSync(path.join(root, d)));
  const files = new Set<string>();
  for (const dir of dirs) {
    const base = path.join(root, dir);
    for (const f of glob.sync('**/*.{tsx,jsx,ts,js}', {
      cwd: base,
      absolute: true,
      nodir: true,
      ignore: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
    })) {
      files.add(path.resolve(f));
    }
  }

  return {
    root,
    packageJson: pkgPath,
    sourceDirs: dirs,
    sourceFiles: [...files].sort(),
    hasReactRouter: Boolean(deps['react-router'] || deps['react-router-dom']),
  };
}
