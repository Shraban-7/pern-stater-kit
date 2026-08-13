import { FeatureRegistry } from './registry.js';
import type { EnvDefinition, GenerationPlan, PlannedFile, StarterConfig } from './types.js';
import { featuresFromConfig } from '../features/selection.js';
import { uniqueBy } from '../utils/merge.js';

export class Planner {
  constructor(private readonly registry: FeatureRegistry) {}

  fromContext(
    config: StarterConfig,
    destination: string,
    files: Map<string, string>,
    packages: GenerationPlan['packages'],
    env: EnvDefinition[],
    dockerServices: Set<string>,
    scripts: Record<string, string>,
    warnings: GenerationPlan['warnings'],
    notes: string[],
  ): GenerationPlan {
    const plannedFiles: PlannedFile[] = [...files.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, contents]) => ({
        path,
        contents,
        action: 'create',
      }));

    return {
      projectName: config.name,
      destination,
      files: plannedFiles,
      packages: uniqueBy(packages, (pkg) => `${pkg.workspace}:${pkg.name}`),
      env: uniqueBy(env, (item) => `${item.workspace ?? 'root'}:${item.key}`),
      dockerServices: [...dockerServices].sort(),
      scripts,
      features: featuresFromConfig(config),
      warnings,
      notes,
    };
  }
}
