import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { parseStarterConfig, safeParseStarterConfig } from './schema.js';
import { applyPreset, createDefaultConfig } from './defaults.js';
import type { CliOptions, StarterConfig, ValidationResult } from './types.js';
import { pathExists } from '../utils/fs.js';

export async function loadConfigFile(path: string): Promise<StarterConfig> {
  const raw = await readFile(path, 'utf8');
  const data: unknown = path.endsWith('.json') ? JSON.parse(raw) : parseYaml(raw);
  if (data && typeof data === 'object' && 'config' in data) {
    return parseStarterConfig((data as { config: unknown }).config);
  }
  return parseStarterConfig(data);
}

export function mergeCliOptions(base: StarterConfig, options: CliOptions): StarterConfig {
  const next = structuredClone(base);
  if (options.preset) Object.assign(next, applyPreset(next, options.preset));
  if (options.orm) next.orm = options.orm;
  if (options.auth) next.auth = options.auth;
  if (options.frontend) next.frontend.kind = options.frontend;
  if (options.architecture) {
    next.architecture = options.architecture;
    if (!next.architectures.includes(options.architecture)) {
      next.architectures.push(options.architecture);
    }
  }
  if (options.rbac) next.rbac = options.rbac;
  if (options.docker) next.docker = next.docker === 'none' ? 'dev' : next.docker;
  if (options.redis) next.cache = 'redis';
  if (options.language) next.language = options.language;
  if (options.packageManager) next.packageManager = options.packageManager;
  if (options.nodeVersion) next.nodeVersion = options.nodeVersion;
  if (options.frontend === 'none') next.monorepo = 'none';
  return next;
}

export function validateConfigDocument(input: unknown): ValidationResult {
  const parsed = safeParseStarterConfig(input);
  if (parsed.success) {
    return { ok: true, errors: [], warnings: [] };
  }
  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => ({
      code: 'INVALID_CONFIG',
      message: issue.message,
      path: issue.path.join('.'),
    })),
    warnings: [],
  };
}

export async function readManifest(cwd: string): Promise<StarterConfig | null> {
  const jsonPath = `${cwd}/starter.json`;
  const yamlPath = `${cwd}/starter.yaml`;
  const path = pathExists(jsonPath) ? jsonPath : pathExists(yamlPath) ? yamlPath : null;
  if (!path) return null;

  const raw = await readFile(path, 'utf8');
  const data: unknown = path.endsWith('.json') ? JSON.parse(raw) : parseYaml(raw);
  if (data && typeof data === 'object' && 'config' in data) {
    return parseStarterConfig((data as { config: unknown }).config);
  }
  return parseStarterConfig(data);
}

export { createDefaultConfig, applyPreset };
