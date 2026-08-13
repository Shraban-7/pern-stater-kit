import type { GenerationContextLike, StarterConfig } from '../core/types.js';
import { pathsFor } from '../core/paths.js';

export function isTs(config: StarterConfig): boolean {
  return config.language !== 'javascript';
}

export function ext(config: StarterConfig, kind: 'ts' | 'tsx' = 'ts'): string {
  return pathsFor(config)[kind === 'tsx' ? 'reactExt' : 'ext'];
}

export function t(config: StarterConfig, type: string, fallback = ''): string {
  return isTs(config) ? type : fallback;
}

export function typeImport(config: StarterConfig, statement: string): string {
  return isTs(config) ? `${statement}\n` : '';
}

export function fileName(config: StarterConfig, base: string, kind: 'ts' | 'tsx' = 'ts'): string {
  return `${base}.${ext(config, kind)}`;
}

export function ctxPaths(ctx: GenerationContextLike) {
  return pathsFor(ctx.config);
}

export function pkgWorkspace(ctx: GenerationContextLike, workspace: 'api' | 'web' | 'root') {
  if (workspace === 'api' && ctxPaths(ctx).apiRoot === '.') return 'api';
  return workspace;
}

export function addApiDeps(
  ctx: GenerationContextLike,
  deps: Array<[string, string, boolean?]>,
): void {
  for (const [name, version, dev] of deps) {
    ctx.addPackage({ name, version, dev: Boolean(dev), workspace: 'api' });
  }
}

export function addWebDeps(
  ctx: GenerationContextLike,
  deps: Array<[string, string, boolean?]>,
): void {
  for (const [name, version, dev] of deps) {
    ctx.addPackage({ name, version, dev: Boolean(dev), workspace: 'web' });
  }
}

export function addRootDeps(
  ctx: GenerationContextLike,
  deps: Array<[string, string, boolean?]>,
): void {
  for (const [name, version, dev] of deps) {
    ctx.addPackage({ name, version, dev: Boolean(dev), workspace: 'root' });
  }
}
