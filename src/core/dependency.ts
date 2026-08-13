import type { FeatureDefinition, StarterConfig, ValidationIssue } from './types.js';
import { FeatureRegistry } from './registry.js';
import { featuresFromConfig } from '../features/selection.js';

export interface DependencyResolution {
  selected: string[];
  implied: Array<{ feature: string; because: string }>;
  missing: Array<{ feature: string; dependency: string }>;
}

export class DependencyResolver {
  constructor(private readonly registry: FeatureRegistry) {}

  resolve(config: StarterConfig, autoAdd = false): DependencyResolution {
    const selected = new Set(featuresFromConfig(config));
    const implied: DependencyResolution['implied'] = [];
    const missing: DependencyResolution['missing'] = [];

    let changed = true;
    while (changed) {
      changed = false;
      for (const id of [...selected]) {
        const feature = this.registry.get(id);
        if (!feature) continue;
        for (const dep of feature.dependencies) {
          if (selected.has(dep)) continue;
          if (autoAdd) {
            selected.add(dep);
            implied.push({ feature: dep, because: id });
            changed = true;
          } else {
            missing.push({ feature: id, dependency: dep });
          }
        }
      }
    }

    return {
      selected: [...selected],
      implied,
      missing,
    };
  }

  requiredPrompts(config: StarterConfig): ValidationIssue[] {
    const { missing } = this.resolve(config, false);
    return missing.map((item) => {
      const dep = this.registry.get(item.dependency);
      return {
        code: 'MISSING_DEPENDENCY',
        message: `You selected ${item.feature}. Dependency: ${item.dependency}. ${dep?.name ?? item.dependency} is currently disabled.`,
        fix: `Add ${item.dependency} automatically?`,
        path: item.feature,
      };
    });
  }

  dependentsOf(featureId: string): FeatureDefinition[] {
    return this.registry.all().filter((feature) => feature.dependencies.includes(featureId));
  }
}
