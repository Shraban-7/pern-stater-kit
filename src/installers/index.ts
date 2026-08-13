import type { FeatureInstaller, StarterConfig, ValidationResult } from '../core/types.js';
import type { GenerationContextLike } from '../core/types.js';
import { FeatureRegistry } from '../core/registry.js';
import { featuresFromConfig } from '../features/selection.js';
import { emptyValidation } from '../core/types.js';

export class CatalogInstaller implements FeatureInstaller {
  constructor(private readonly registry = new FeatureRegistry()) {}

  id(): string {
    return 'catalog';
  }

  supports(): boolean {
    return true;
  }

  validate(): ValidationResult {
    return emptyValidation();
  }

  async install(context: GenerationContextLike): Promise<void> {
    const selected = featuresFromConfig(context.config);
    for (const id of selected) {
      const feature = this.registry.get(id);
      if (!feature) continue;
      for (const pkg of feature.packages) {
        context.addPackage({
          name: pkg.name,
          version: pkg.version,
          dev: pkg.dev,
          workspace: pkg.workspace,
        });
      }
      for (const env of feature.env) {
        context.addEnv(env);
      }
      if (context.config.docker !== 'none') {
        for (const service of feature.dockerServices) {
          context.addDockerService(service);
        }
      }
    }

    context.addEnv({
      key: 'NODE_ENV',
      example: 'development',
      required: true,
      description: 'Runtime environment',
      workspace: 'api',
    });
    context.addEnv({
      key: 'PORT',
      example: '4000',
      required: true,
      description: 'API port',
      workspace: 'api',
    });
    context.addEnv({
      key: 'CORS_ORIGIN',
      example: 'http://localhost:5173',
      required: true,
      description: 'Allowed CORS origin',
      workspace: 'api',
    });
  }

  async remove(): Promise<void> {
    // Removal is handled by the feature-remove command using the dependency graph.
  }
}

export function createInstallers(): FeatureInstaller[] {
  return [new CatalogInstaller()];
}

export function installerSupports(config: StarterConfig, id: string): boolean {
  return featuresFromConfig(config).includes(id);
}
