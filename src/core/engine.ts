import { ConflictDetector } from './conflict.js';
import { GenerationContext } from './context.js';
import { DependencyResolver } from './dependency.js';
import { Planner } from './planner.js';
import { ArchitectureRegistry, FeatureRegistry, PatternRegistry } from './registry.js';
import { validateNodeVersion } from './runtime.js';
import type {
  FeatureInstaller,
  GenerationPlan,
  Generator,
  StarterConfig,
  ValidationIssue,
  ValidationResult,
} from './types.js';
import { Workspace } from './workspace.js';
import { destinationConflict } from './overwrite.js';
import { featuresFromConfig } from '../features/selection.js';
import { recommendPatterns } from '../patterns/recommendations.js';
import { createInstallers } from '../installers/index.js';
import { createGenerators } from '../generators/index.js';

export interface EngineOptions {
  cwd?: string;
  dryRun?: boolean;
  force?: boolean;
  autoAddDependencies?: boolean;
}

export class GenerationEngine {
  readonly features: FeatureRegistry;
  readonly architectures: ArchitectureRegistry;
  readonly patterns: PatternRegistry;
  readonly dependency: DependencyResolver;
  readonly conflicts: ConflictDetector;
  readonly planner: Planner;
  readonly workspace: Workspace;
  readonly installers: FeatureInstaller[];
  readonly generators: Generator[];

  constructor(deps?: {
    features?: FeatureRegistry;
    architectures?: ArchitectureRegistry;
    patterns?: PatternRegistry;
    installers?: FeatureInstaller[];
    generators?: Generator[];
  }) {
    this.features = deps?.features ?? new FeatureRegistry();
    this.architectures = deps?.architectures ?? new ArchitectureRegistry();
    this.patterns = deps?.patterns ?? new PatternRegistry();
    this.dependency = new DependencyResolver(this.features);
    this.conflicts = new ConflictDetector(this.features, this.architectures);
    this.planner = new Planner(this.features);
    this.workspace = new Workspace();
    this.installers = deps?.installers ?? createInstallers();
    this.generators = deps?.generators ?? createGenerators();
  }

  validate(config: StarterConfig): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    errors.push(...this.conflicts.detect(config).filter((item) => item.code !== 'MISSING_DEPENDENCY'));
    const deps = this.dependency.requiredPrompts(config);
    errors.push(...deps);

    if (config.designPatterns.includes('singleton')) {
      warnings.push({
        code: 'SINGLETON_WARNING',
        message: 'Singleton is rarely needed in Node.js. Prefer dependency injection.',
      });
    }

    for (const generator of this.generators) {
      if (!generator.supports(config)) continue;
      const result = generator.validate(config);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return { ok: errors.length === 0, errors, warnings };
  }

  async plan(config: StarterConfig, destination: string, options: EngineOptions = {}): Promise<GenerationPlan> {
    const resolved = this.dependency.resolve(config, options.autoAddDependencies ?? false);
    if (resolved.missing.length && !options.autoAddDependencies) {
      const issues = this.dependency.requiredPrompts(config);
      throw Object.assign(new Error(issues[0]?.message ?? 'Unresolved feature dependencies'), {
        issues,
      });
    }

    const context = new GenerationContext(config, destination, Boolean(options.dryRun));
    for (const installer of this.installers) {
      if (!installer.supports(config)) continue;
      const result = installer.validate(config);
      if (!result.ok) {
        throw Object.assign(new Error(result.errors[0]?.message ?? 'Installer validation failed'), {
          issues: result.errors,
        });
      }
      await installer.install(context);
    }

    for (const generator of this.generators) {
      if (!generator.supports(config)) continue;
      await generator.generate(context);
    }

    for (const rec of recommendPatterns(config)) {
      if (!config.designPatterns.includes(rec.pattern) && rec.pattern !== 'singleton') {
        context.addNote(`Recommended pattern ${rec.pattern}: ${rec.reason}`);
      }
    }

    return this.planner.fromContext(
      config,
      destination,
      context.files,
      context.snapshotPackages(),
      context.env,
      context.dockerServices,
      context.scripts,
      context.warnings,
      context.notes,
    );
  }

  async generate(
    config: StarterConfig,
    destination: string,
    options: EngineOptions = {},
  ): Promise<GenerationPlan> {
    const nodeIssues = await validateNodeVersion(config.nodeVersion);
    if (nodeIssues.length) {
      throw Object.assign(new Error(nodeIssues[0]?.message ?? 'Node version invalid'), {
        issues: nodeIssues,
      });
    }

    const validation = this.validate(config);
    if (!validation.ok) {
      throw Object.assign(new Error(validation.errors[0]?.message ?? 'Invalid configuration'), {
        issues: validation.errors,
      });
    }

    if (!options.force && destinationConflict(destination) && !options.dryRun) {
      throw Object.assign(new Error(`Destination already exists: ${destination}`), {
        issues: [
          {
            code: 'DESTINATION_EXISTS',
            message: `Folder already exists: ${destination}`,
            fix: 'Choose another name or pass --force.',
          },
        ],
      });
    }

    const plan = await this.plan(config, destination, options);
    if (options.dryRun) return plan;

    const temp = await this.workspace.createTemp();
    try {
      await this.workspace.materialize(plan, temp);
      await this.workspace.finalize(temp, destination);
    } catch (error) {
      await this.workspace.cleanup(temp);
      throw error;
    }

    return plan;
  }

  selectedFeatures(config: StarterConfig): string[] {
    return featuresFromConfig(config);
  }
}

export const engine = new GenerationEngine();
