export { GenerationEngine, engine } from './core/engine.js';
export {
  parseStarterConfig,
  safeParseStarterConfig,
  starterConfigSchema,
} from './core/schema.js';
export { createDefaultConfig, applyPreset } from './core/defaults.js';
export {
  loadConfigFile,
  mergeCliOptions,
  validateConfigDocument,
  readManifest,
} from './core/config.js';
export { renderPlan, summarizePlan } from './core/plan-render.js';
export { PathResolver, pathsFor } from './core/paths.js';
export { FeatureRegistry, ArchitectureRegistry, PatternRegistry } from './core/registry.js';
export { FEATURE_CATALOG } from './features/catalog.js';
export { PATTERN_CATALOG } from './patterns/catalog.js';
export { ARCHITECTURE_CATALOG } from './architectures/catalog.js';
export {
  featuresFromConfig,
  applyFeatureToConfig,
  removeFeatureFromConfig,
} from './features/selection.js';
export { recommendPatterns } from './patterns/recommendations.js';
export {
  createMakeGenerators,
  generateCrud,
  generateScaffold,
  generateModule,
  generatePattern,
  parseFieldDsl,
  formControlFor,
} from './generators/make/index.js';
export { createGenerators } from './generators/index.js';
export * from './core/types.js';
