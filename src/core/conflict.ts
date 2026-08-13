import type { StarterConfig, ValidationIssue } from './types.js';
import { FeatureRegistry, ArchitectureRegistry } from './registry.js';
import { featuresFromConfig } from '../features/selection.js';

export class ConflictDetector {
  constructor(
    private readonly features: FeatureRegistry,
    private readonly architectures: ArchitectureRegistry,
  ) {}

  detect(config: StarterConfig): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const selected = featuresFromConfig(config);

    for (const id of selected) {
      const feature = this.features.get(id);
      if (!feature) continue;
      for (const conflict of feature.conflicts) {
        if (selected.includes(conflict)) {
          issues.push({
            code: 'FEATURE_CONFLICT',
            message: `${feature.name} conflicts with ${this.features.get(conflict)?.name ?? conflict}.`,
            path: id,
            fix: `Remove either ${id} or ${conflict}.`,
          });
        }
      }
    }

    const architecture = this.architectures.get(config.architecture);
    if (architecture) {
      for (const extra of config.architectures) {
        if (architecture.conflicts.includes(extra)) {
          issues.push({
            code: 'ARCHITECTURE_CONFLICT',
            message: `${architecture.name} cannot be combined with ${extra}.`,
            path: extra,
          });
        }
      }
    }

    if (config.testing.unit === 'vitest' && selected.includes('jest')) {
      issues.push({
        code: 'FEATURE_CONFLICT',
        message: 'Vitest and Jest should not both be enabled.',
        fix: 'Choose one unit test runner.',
      });
    }

    if (config.codeQuality.includes('biome') && config.codeQuality.includes('prettier')) {
      issues.push({
        code: 'FEATURE_CONFLICT',
        message: 'Biome and Prettier overlap. Do not configure both unless you have a specific split.',
        fix: 'Choose Biome or Prettier.',
      });
    }

    if (config.queue === 'bullmq' && config.cache !== 'redis') {
      issues.push({
        code: 'MISSING_DEPENDENCY',
        message: 'BullMQ requires Redis.',
        path: 'queue',
        fix: 'Enable Redis or disable BullMQ.',
      });
    }

    if (config.frontend.kind === 'none' && config.admin !== 'none') {
      issues.push({
        code: 'FEATURE_CONFLICT',
        message: 'Admin dashboard requires a frontend.',
        path: 'admin',
      });
    }

    if (config.backend.api.includes('graphql') && !config.backend.graphqlServer) {
      issues.push({
        code: 'MISSING_DEPENDENCY',
        message: 'GraphQL requires a server implementation (Apollo or Yoga).',
        path: 'backend.graphqlServer',
      });
    }

    if (config.cqrs !== 'none' && config.architecture === 'simple-mvc') {
      issues.push({
        code: 'ARCHITECTURE_CONFLICT',
        message: 'CQRS should not be enabled for Simple MVC.',
        fix: 'Choose a richer architecture or disable CQRS.',
      });
    }

    return issues;
  }
}
