import type { GenerationContextLike, Generator, PlannedPackage, StarterConfig, ValidationResult } from '../core/types.js';
import { emptyValidation } from '../core/types.js';
import { pathsFor } from '../core/paths.js';

export class PackageManifestGenerator implements Generator {
  id(): string {
    return 'package-manifests';
  }

  supports(): boolean {
    return true;
  }

  validate(): ValidationResult {
    return emptyValidation();
  }

  async generate(ctx: GenerationContextLike): Promise<void> {
    const byWorkspace = new Map<string, PlannedPackage[]>();
    for (const pkg of ctx.packages) {
      const list = byWorkspace.get(pkg.workspace) ?? [];
      list.push(pkg);
      byWorkspace.set(pkg.workspace, list);
    }

    for (const [workspace, packages] of byWorkspace) {
      const file = packageJsonPath(ctx.config, workspace);
      if (!file) continue;
      const raw = ctx.files.get(file);
      const manifest = raw ? parseJson(raw) : baseManifest(ctx, workspace);
      const dependencies = asRecord(manifest.dependencies);
      const devDependencies = asRecord(manifest.devDependencies);

      for (const pkg of packages) {
        if (pkg.dev) {
          delete dependencies[pkg.name];
          devDependencies[pkg.name] = pkg.version;
        } else {
          delete devDependencies[pkg.name];
          dependencies[pkg.name] = pkg.version;
        }
      }

      manifest.dependencies = sortRecord(dependencies);
      manifest.devDependencies = sortRecord(devDependencies);
      if (!Object.keys(manifest.dependencies as object).length) delete manifest.dependencies;
      if (!Object.keys(manifest.devDependencies as object).length) delete manifest.devDependencies;

      ctx.writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`);
    }
  }
}

function packageJsonPath(config: StarterConfig, workspace: string): string | null {
  const paths = pathsFor(config);
  if (workspace === 'root') return 'package.json';
  if (workspace === 'api') {
    return paths.apiRoot === '.' ? 'package.json' : `${paths.apiRoot}/package.json`;
  }
  if (workspace === 'web') {
    return config.frontend.kind === 'none' ? null : `${paths.webRoot}/package.json`;
  }
  if (workspace === 'admin') {
    if (config.admin === 'none' || config.admin === 'custom') return null;
    return `${paths.adminRoot}/package.json`;
  }
  return `${workspace}/package.json`;
}

function baseManifest(ctx: GenerationContextLike, workspace: string): Record<string, unknown> {
  return {
    name: workspace === 'root' ? ctx.config.name : workspace,
    version: '0.1.0',
    private: true,
    type: 'module',
  };
}

function parseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  return { ...(value as Record<string, string>) };
}

function sortRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}
