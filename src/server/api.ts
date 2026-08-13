import { applyPreset, createDefaultConfig } from '../core/defaults.js';
import { GenerationEngine } from '../core/engine.js';
import { normalizeConfig } from '../core/normalize.js';
import { parseStarterConfig } from '../core/schema.js';
import type { PresetId, StarterConfig } from '../core/types.js';
import { FEATURE_CATALOG } from '../features/catalog.js';
import { ARCHITECTURE_CATALOG } from '../architectures/catalog.js';
import { PATTERN_CATALOG } from '../patterns/catalog.js';

export { normalizeConfig } from '../core/normalize.js';

let engine: GenerationEngine | undefined;

function getEngine(): GenerationEngine {
  engine ??= new GenerationEngine();
  return engine;
}

export interface ApiResult {
  status: number;
  body: unknown;
}

function nextSteps(config: StarterConfig): string[] {
  return [
    `cd ${config.name}`,
    config.frontend.kind === 'none'
      ? 'cp .env.example .env'
      : 'cp apps/api/.env.example apps/api/.env && cp apps/web/.env.example apps/web/.env',
    `${config.packageManager} install`,
    config.docker !== 'none' ? 'docker compose up -d' : null,
    `${config.packageManager} db:migrate`,
    `${config.packageManager} dev`,
  ].filter((item): item is string => Boolean(item));
}

function fail(error: unknown): ApiResult {
  const message = error instanceof Error ? error.message : String(error);
  const issues = (error as { issues?: Array<{ message: string; fix?: string }> }).issues;
  return {
    status: 400,
    body: { ok: false, error: message, issues, fix: issues?.[0]?.fix },
  };
}

export async function handleStarterApi(
  method: string,
  urlPath: string,
  body: unknown = {},
): Promise<ApiResult> {
  const path = urlPath.split('?')[0] ?? urlPath;

  try {
    if (method === 'GET' && path === '/api/defaults') {
      const config = normalizeConfig(createDefaultConfig('my-app'));
      return { status: 200, body: { config } };
    }

    if (method === 'GET' && path === '/api/catalog') {
      return {
        status: 200,
        body: {
          features: FEATURE_CATALOG,
          architectures: ARCHITECTURE_CATALOG,
          patterns: PATTERN_CATALOG,
          presets: ['basic', 'api', 'saas', 'ecommerce', 'enterprise'],
        },
      };
    }

    if (method === 'POST' && path === '/api/preset') {
      const payload = (body ?? {}) as { name?: string; preset?: PresetId };
      const base = createDefaultConfig(payload.name?.trim() || 'my-app');
      const config = normalizeConfig(
        payload.preset ? applyPreset(base, payload.preset) : base,
      );
      return { status: 200, body: { config } };
    }

    if (method === 'POST' && (path === '/api/plan' || path === '/api/bundle')) {
      const payload = (body ?? {}) as { config?: unknown };
      const config = normalizeConfig(parseStarterConfig(payload.config));
      const plan = await getEngine().plan(config, config.name, {
        dryRun: true,
        autoAddDependencies: true,
      });
      const shared = {
        files: plan.files.map((file) => file.path),
        packages: plan.packages,
        env: plan.env.map((item) => item.key),
        dockerServices: plan.dockerServices,
        features: plan.features,
        warnings: plan.warnings,
        notes: plan.notes,
        next: nextSteps(config),
      };
      if (path === '/api/plan') return { status: 200, body: shared };
      return {
        status: 200,
        body: {
          ...shared,
          project: config.name,
          contents: plan.files.map((file) => ({ path: file.path, contents: file.contents })),
        },
      };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return fail(error);
  }
}
