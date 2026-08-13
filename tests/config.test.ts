import { describe, expect, it } from 'vitest';
import { applyPreset, createDefaultConfig } from '../src/core/defaults.js';
import { parseStarterConfig, safeParseStarterConfig } from '../src/core/schema.js';
import { ConflictDetector } from '../src/core/conflict.js';
import { DependencyResolver } from '../src/core/dependency.js';
import { ArchitectureRegistry, FeatureRegistry } from '../src/core/registry.js';
import { featuresFromConfig } from '../src/features/selection.js';
import { recommendPatterns } from '../src/patterns/recommendations.js';
import { applyFeatureToConfig } from '../src/features/selection.js';

describe('starter config schema', () => {
  it('parses the default TypeScript PERN config', () => {
    const config = createDefaultConfig('marketplace');
    expect(parseStarterConfig(config).name).toBe('marketplace');
    expect(config.language).toBe('typescript');
    expect(config.orm).toBe('prisma');
    expect(config.auth).toBe('jwt-refresh-token');
  });

  it('rejects invalid project names', () => {
    const result = safeParseStarterConfig({
      ...createDefaultConfig('ok'),
      name: '1bad',
    });
    expect(result.success).toBe(false);
  });
});

describe('presets', () => {
  it('api preset disables the frontend and enables redis + bullmq', () => {
    const config = applyPreset(createDefaultConfig('api-app'), 'api');
    expect(config.frontend.kind).toBe('none');
    expect(config.cache).toBe('redis');
    expect(config.queue).toBe('bullmq');
    expect(config.docker).toBe('dev');
  });

  it('saas preset enables stripe, sentry, and shared-db tenancy', () => {
    const config = applyPreset(createDefaultConfig('saas-app'), 'saas');
    expect(config.payments).toContain('stripe');
    expect(config.monitoring).toContain('sentry');
    expect(config.multiTenancy).toBe('shared-db');
  });

  it('ecommerce preset includes regional payment gateways', () => {
    const config = applyPreset(createDefaultConfig('shop'), 'ecommerce');
    expect(config.payments).toEqual(expect.arrayContaining(['stripe', 'bkash', 'nagad']));
  });
});

describe('feature selection', () => {
  it('maps config fields onto feature ids', () => {
    const ids = featuresFromConfig(createDefaultConfig('app'));
    expect(ids).toEqual(
      expect.arrayContaining([
        'backend-express',
        'orm-prisma',
        'auth-jwt-refresh-token',
        'frontend-vite-react',
        'validation-zod',
      ]),
    );
    expect(ids.some((id) => id.endsWith('-none'))).toBe(false);
  });
});

describe('dependency resolver', () => {
  const registry = new FeatureRegistry();
  const resolver = new DependencyResolver(registry);

  it('requires redis when bullmq is selected', () => {
    const config = createDefaultConfig('jobs');
    config.queue = 'bullmq';
    config.cache = 'none';
    const result = resolver.resolve(config, false);
    expect(result.missing.some((item) => item.dependency === 'cache-redis')).toBe(true);
  });

  it('can auto-add redis for bullmq', () => {
    const config = createDefaultConfig('jobs');
    config.queue = 'bullmq';
    config.cache = 'none';
    const result = resolver.resolve(config, true);
    expect(result.selected).toContain('cache-redis');
    expect(result.implied.some((item) => item.feature === 'cache-redis')).toBe(true);
  });
});

describe('conflict detector', () => {
  const detector = new ConflictDetector(new FeatureRegistry(), new ArchitectureRegistry());

  it('flags bullmq without redis', () => {
    const config = createDefaultConfig('jobs');
    config.queue = 'bullmq';
    config.cache = 'none';
    const issues = detector.detect(config);
    expect(issues.some((issue) => issue.code === 'MISSING_DEPENDENCY')).toBe(true);
  });

  it('flags biome overlapping prettier', () => {
    const config = createDefaultConfig('lint');
    config.codeQuality = ['biome', 'prettier'];
    const issues = detector.detect(config);
    expect(issues.some((issue) => issue.message.includes('Biome'))).toBe(true);
  });
});

describe('pattern recommendations', () => {
  it('recommends strategy/adapter/factory for multiple payment providers', () => {
    const config = createDefaultConfig('pay');
    config.payments = ['stripe', 'bkash'];
    const recs = recommendPatterns(config);
    expect(recs.map((item) => item.pattern)).toEqual(
      expect.arrayContaining(['strategy', 'adapter', 'factory']),
    );
  });

  it('warns about singleton', () => {
    const config = createDefaultConfig('single');
    config.designPatterns = ['singleton'];
    const recs = recommendPatterns(config);
    expect(recs.some((item) => item.pattern === 'singleton')).toBe(true);
  });
});

describe('applyFeatureToConfig', () => {
  it('enables redis from the cache-redis feature id', () => {
    const next = applyFeatureToConfig(createDefaultConfig('app'), 'cache-redis');
    expect(next.cache).toBe('redis');
  });
});
