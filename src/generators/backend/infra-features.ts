import type {
  GenerationContextLike,
  Generator,
  StarterConfig,
  ValidationResult,
} from '../../core/types.js';
import { emptyValidation } from '../../core/types.js';
import { addApiDeps, ctxPaths, fileName, isTs } from '../helpers.js';
import {
  AUTH_RATE_MAX,
  GENERAL_RATE_MAX,
  SENSITIVE_RATE_MAX,
  isExpress,
  isFastify,
  relImport,
  t,
  writeSrc,
} from './shared.js';

export class InfraFeaturesGenerator implements Generator {
  id() {
    return 'backend-infra';
  }

  supports(config: StarterConfig) {
    return (
      config.cache === 'redis' ||
      config.queue === 'bullmq' ||
      config.events === 'redis-pubsub' ||
      config.monitoring.includes('sentry') ||
      config.monitoring.includes('opentelemetry') ||
      config.monitoring.includes('prometheus') ||
      true
    );
  }

  validate(_config: StarterConfig): ValidationResult {
    return emptyValidation();
  }

  async generate(context: GenerationContextLike): Promise<void> {
    writeRequestSize(context);
    if (needsRedis(context.config)) writeRedis(context);
    if (context.config.monitoring.includes('sentry')) writeSentry(context);
    if (context.config.monitoring.includes('opentelemetry')) writeOtel(context);
    if (context.config.monitoring.includes('prometheus')) writePrometheus(context);
  }
}

function needsRedis(config: StarterConfig): boolean {
  return config.cache === 'redis' || config.queue === 'bullmq' || config.events === 'redis-pubsub';
}

function writeRequestSize(ctx: GenerationContextLike): void {
  const c = ctx.config;
  if (!isExpress(c)) return;
  const p = ctxPaths(ctx);
  const file = p.apiFile('middleware', 'request-size');
  writeSrc(
    ctx,
    file,
    `import { AppError } from '${relImport(file, p.apiFile('errors', 'index'))}';
export function requestSizeGuard(req, _res, next) {
  const length = Number(req.headers['content-length'] ?? 0);
  if (length > 1024 * 1024) return next(new AppError('Payload too large', 413, 'VALIDATION_ERROR'));
  next();
}
`,
  );
  ctx.addMiddleware({
    name: 'request-size',
    importStatement: `import { requestSizeGuard } from '${relImport(p.apiSrc(fileName(c, 'app')), file)}';`,
    useStatement: 'app.use(requestSizeGuard);',
    order: 38,
  });
}

function writeRedis(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  addApiDeps(ctx, [['ioredis', '^5.6.0']]);
  ctx.addEnv({
    key: 'REDIS_URL',
    example: 'redis://localhost:6379',
    required: true,
    description: 'Redis connection URL',
    workspace: 'api',
  });
  if (c.docker !== 'none') ctx.addDockerService('redis');

  const redisFile = p.apiFile('lib', 'redis');
  const envFile = p.apiFile('config', 'env');
  writeSrc(
    ctx,
    redisFile,
    `import Redis from 'ioredis';
import { env } from '${relImport(redisFile, envFile)}';
import { logger } from '${relImport(redisFile, p.apiFile('lib', 'logger'))}';

export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
redis.on('error', (error) => { logger.error({ err: { message: error.message } }, 'redis_error'); });

export async function pingRedis() {
  try { await redis.ping(); return true; } catch { return false; }
}
`,
  );

  if (c.cache === 'redis') {
    const cacheFile = p.apiFile('lib', 'cache');
    writeSrc(
      ctx,
      cacheFile,
      `import { redis } from '${relImport(cacheFile, redisFile)}';

export async function cacheGet${t(c, '<T = unknown>')}(key${t(c, ': string')})${t(c, ': Promise<T | null>')} {
  const raw = await redis.get(key);
  return raw ? JSON.parse(raw) : null;
}

export async function cacheSet(key${t(c, ': string')}, value${t(c, ': unknown')}, ttlSeconds = 60) {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheDel(key${t(c, ': string')}) { await redis.del(key); }

export async function cacheAside${t(c, '<T>')}(key${t(c, ': string')}, ttlSeconds${t(c, ': number')}, loader${t(c, ': () => Promise<T>')})${t(c, ': Promise<T>')} {
  const hit = await cacheGet${t(c, '<T>')}(key);
  if (hit !== null) return hit;
  const value = await loader();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

export async function invalidatePrefix(prefix${t(c, ': string')}) {
  const keys = await redis.keys(prefix + '*');
  if (keys.length) await redis.del(...keys);
}
`,
    );
  }

  if (isExpress(c)) {
    addApiDeps(ctx, [['rate-limit-redis', '^4.2.0']]);
    const rateFile = p.apiFile('middleware', 'rate-limit');
    const errorsFile = p.apiFile('errors', 'index');
    writeSrc(
      ctx,
      rateFile,
      `import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { RateLimitError } from '${relImport(rateFile, errorsFile)}';
import { redis } from '${relImport(rateFile, redisFile)}';

function limiter(max${t(c, ': number')}, prefix${t(c, ': string')}) {
  return rateLimit({
    windowMs: 60_000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health' || req.path === '/ready',
    handler: (_req, _res, next) => next(new RateLimitError()),
    store: new RedisStore({ sendCommand: (...args) => redis.call(...args), prefix: 'rl:' + prefix + ':' }),
  });
}

export const generalLimiter = limiter(${GENERAL_RATE_MAX}, 'general');
export const authLimiter = limiter(${AUTH_RATE_MAX}, 'auth');
export const sensitiveLimiter = limiter(${SENSITIVE_RATE_MAX}, 'sensitive');
`,
    );
  }
}

function writeSentry(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  addApiDeps(ctx, [['@sentry/node', '^9.10.1']]);
  const file = p.apiFile('lib', 'sentry');
  const envFile = p.apiFile('config', 'env');
  writeSrc(
    ctx,
    file,
    `import * as Sentry from '@sentry/node';
import { env } from '${relImport(file, envFile)}';

export function initSentry() {
  if (!env.SENTRY_DSN) return;
  Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1 });
}

export { Sentry };
`,
  );
  ctx.addMiddleware({
    name: 'sentry',
    importStatement: `import { initSentry } from '${relImport(p.apiSrc(fileName(c, 'app')), file)}';`,
    useStatement: 'initSentry();',
    order: 1,
  });
}

function writeOtel(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  addApiDeps(ctx, [
    ['@opentelemetry/sdk-node', '^0.200.0'],
    ['@opentelemetry/auto-instrumentations-node', '^0.57.0'],
  ]);
  const file = p.apiFile('lib', 'otel');
  writeSrc(
    ctx,
    file,
    `import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({ instrumentations: [getNodeAutoInstrumentations()] });
export function initOpenTelemetry() { void sdk.start(); }
export async function shutdownOpenTelemetry() { await sdk.shutdown(); }
`,
  );
  ctx.addMiddleware({
    name: 'otel',
    importStatement: `import { initOpenTelemetry } from '${relImport(p.apiSrc(fileName(c, 'app')), file)}';`,
    useStatement: 'initOpenTelemetry();',
    order: 2,
  });
}

function writePrometheus(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  addApiDeps(ctx, [['prom-client', '^15.1.3']]);
  const file = p.apiFile('routes', 'metrics');
  const appFile = p.apiSrc(fileName(c, 'app'));
  if (isFastify(c)) {
    writeSrc(
      ctx,
      file,
      `import client from 'prom-client';
${isTs(c) ? `import type { FastifyInstance } from 'fastify';\n` : ''}
const register = new client.Registry();
client.collectDefaultMetrics({ register });
export async function metricsRouter(app${t(c, ': FastifyInstance')}) {
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
}
`,
    );
  } else {
    writeSrc(
      ctx,
      file,
      `import { Router } from 'express';
import client from 'prom-client';
const register = new client.Registry();
client.collectDefaultMetrics({ register });
export const metricsRouter = Router();
metricsRouter.get('/metrics', async (_req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});
`,
    );
  }
  ctx.addRoute({
    name: 'metrics',
    importStatement: `import { metricsRouter } from '${relImport(appFile, file)}';`,
    mountPath: '/',
    routerIdentifier: 'metricsRouter',
    order: 15,
  });
}
