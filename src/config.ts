import fs from 'node:fs';
import path from 'node:path';
import { SurpryzeConfigSchema, type SurpryzeConfig } from './knowledge/schemas.js';

export const CONFIG_FILE = 'surpryze.config.json';

export function resolveProjectRoot(cwd?: string): string {
  return path.resolve(cwd ?? process.cwd());
}

export function surpryzeDir(root: string): string {
  return path.join(root, '.surpryze');
}

export function configPath(root: string): string {
  return path.join(surpryzeDir(root), CONFIG_FILE);
}

export function loadConfig(root: string): SurpryzeConfig {
  const p = configPath(root);
  if (!fs.existsSync(p)) {
    throw new Error(`Surpryze not initialized. Run \`surpryze init\` in ${root}`);
  }
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  return SurpryzeConfigSchema.parse(raw);
}

export function saveConfig(config: SurpryzeConfig): void {
  fs.mkdirSync(config.surpryzeDir, { recursive: true });
  fs.writeFileSync(path.join(config.surpryzeDir, CONFIG_FILE), JSON.stringify(config, null, 2));
}

export function defaultConfig(root: string): SurpryzeConfig {
  return SurpryzeConfigSchema.parse({
    version: 1,
    projectRoot: root,
    surpryzeDir: surpryzeDir(root),
    defaultExploreBudget: 20,
    maxConcurrency: 2,
    environment: 'test',
  });
}
