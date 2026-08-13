import { sortByOrder } from '../../utils/merge.js';
import type {
  GenerationContextLike,
  Generator,
  MiddlewareRegistration,
  RouteRegistration,
  StarterConfig,
  ValidationResult,
} from '../../core/types.js';
import { emptyValidation } from '../../core/types.js';
import { addApiDeps, ctxPaths, fileName, isTs } from '../helpers.js';
import {
  ACCESS_TOKEN_TTL,
  AUTH_RATE_MAX,
  GENERAL_RATE_MAX,
  JSON_BODY_LIMIT,
  REFRESH_TOKEN_TTL_DAYS,
  SENSITIVE_RATE_MAX,
  apiPackageJsonPath,
  apiPkgName,
  buildPrismaSchema,
  envSchemaExpr,
  generic,
  graphqlServer,
  hasAuth,
  hasGraphql,
  hasHealth,
  hasJwt,
  hasOAuth,
  hasOpenApi,
  hasRefresh,
  hasRest,
  hasSession,
  hasSwaggerUi,
  httpTypes,
  interfaceBlock,
  isExpress,
  isFastify,
  needsJwtSecret,
  needsRedis,
  params,
  parseEnvCall,
  prismaDir,
  relAsset,
  relImport,
  ret,
  t,
  typeImport,
  validationImport,
  writeSrc,
} from './shared.js';

export class CoreGenerator implements Generator {
  id() {
    return 'backend-core';
  }

  supports(_config: StarterConfig) {
    return true;
  }

  validate(_config: StarterConfig): ValidationResult {
    return emptyValidation();
  }

  async generate(context: GenerationContextLike): Promise<void> {
    const c = context.config;
    addCorePackages(context);
    addCoreEnv(context);
    writePackageJson(context);
    if (isTs(c)) writeTsconfig(context);
    writeVitestConfig(context);
    writeConfig(context);
    writeLogger(context);
    writeUtils(context);
    writeHttpTypes(context);
    writeMiddlewares(context);
    writeHealth(context);
    writeV1Placeholder(context);
    if (hasGraphql(c)) writeGraphql(context);
    if (hasOpenApi(c)) writeOpenApi(context);
    writeApp(context);
    writeServer(context);
    registerCoreMiddleware(context);
  }
}

export class AppAssemblerGenerator implements Generator {
  id() {
    return 'app-assembler';
  }

  supports(_config: StarterConfig) {
    return true;
  }

  validate(_config: StarterConfig): ValidationResult {
    return emptyValidation();
  }

  async generate(context: GenerationContextLike): Promise<void> {
    assembleV1(context);
    assembleApp(context);
    if (context.config.orm === 'prisma') {
      writeSrc(context, `${prismaDir(context)}/schema.prisma`, buildPrismaSchema(context));
    }
  }
}

function addCorePackages(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const deps: Array<[string, string, boolean?]> = [
    ['dotenv', '^16.4.7'],
    ['cookie-parser', '^1.4.7'],
  ];

  if (isExpress(c)) {
    deps.push(
      ['express', '^4.21.2'],
      ['cors', '^2.8.5'],
      ['helmet', '^8.1.0'],
      ['express-rate-limit', '^7.5.0'],
    );
  } else {
    deps.push(
      ['fastify', '^5.2.1'],
      ['@fastify/cors', '^11.0.1'],
      ['@fastify/helmet', '^13.0.1'],
      ['@fastify/cookie', '^11.0.2'],
      ['@fastify/rate-limit', '^10.2.2'],
      ['@fastify/formbody', '^8.0.2'],
    );
  }

  if (c.logging === 'pino') {
    if (isExpress(c)) deps.push(['pino-http', '^10.4.0']);
    deps.push(['pino-pretty', '^13.0.0', true]);
  }

  if (hasGraphql(c)) {
    deps.push(['graphql', '^16.10.0']);
    if (graphqlServer(c) === 'apollo') {
      deps.push(['@apollo/server', '^4.11.3']);
      if (isExpress(c)) deps.push(['@as-integrations/express4', '^1.0.0']);
    } else {
      deps.push(['graphql-yoga', '^5.13.1']);
    }
  }

  if (hasSwaggerUi(c)) {
    if (isExpress(c)) deps.push(['swagger-ui-express', '^5.0.1'], ['yaml', '^2.7.1']);
    else deps.push(['@fastify/swagger', '^9.4.2'], ['@fastify/swagger-ui', '^5.2.2']);
  } else if (hasOpenApi(c)) {
    deps.push(['yaml', '^2.7.1']);
  }

  deps.push(
    ['tsx', '^4.19.3', true],
    ['vitest', c.testing.unit === 'vitest' ? '^3.0.9' : '^3.0.9', true],
    ['supertest', '^7.1.0', true],
    ['@types/node', '^22.13.14', true],
    ['@types/supertest', '^6.0.3', true],
  );

  if (isTs(c)) {
    deps.push(['typescript', '^7.0.2', true]);
    if (isExpress(c)) {
      deps.push(
        ['@types/express', '^4.17.21', true],
        ['@types/cors', '^2.8.17', true],
        ['@types/cookie-parser', '^1.4.8', true],
      );
    }
    if (hasSwaggerUi(c) && isExpress(c)) {
      deps.push(['@types/swagger-ui-express', '^4.1.8', true]);
    }
  }

  if (c.testing.unit === 'jest') {
    deps.push(['jest', '^29.7.0', true], ['ts-jest', '^29.3.1', true]);
  }

  addApiDeps(ctx, deps);
}

function addCoreEnv(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const add = (
    key: string,
    example: string,
    required: boolean,
    description: string,
    secret = false,
  ) =>
    ctx.addEnv({ key, example, required, description, workspace: 'api', secret });

  add('LOG_LEVEL', 'info', false, 'Log level');
  add('BODY_LIMIT', JSON_BODY_LIMIT, false, 'JSON body size limit');

  if (needsJwtSecret(c)) {
    add('JWT_SECRET', 'change-me-access-secret-min-32-chars-long', true, 'Access token secret', true);
    add('JWT_ACCESS_EXPIRES', ACCESS_TOKEN_TTL, false, 'Access token TTL');
  }
  if (hasRefresh(c)) {
    add('JWT_REFRESH_SECRET', 'change-me-refresh-secret-min-32-chars', true, 'Refresh token secret', true);
    add('JWT_REFRESH_EXPIRES', `${REFRESH_TOKEN_TTL_DAYS}d`, false, 'Refresh token TTL');
  }
  if (hasSession(c)) {
    add('SESSION_SECRET', 'change-me-session-secret-min-32-chars-long', true, 'Session secret', true);
    add('SESSION_NAME', 'sid', false, 'Session cookie name');
  }
  if (needsRedis(c) && c.cache !== 'redis') {
    add('REDIS_URL', 'redis://localhost:6379', true, 'Redis connection URL');
  }
  if (hasOpenApi(c)) {
    add('ENABLE_API_DOCS', 'false', false, 'Serve API docs in production');
  }
  for (const provider of c.oauthProviders) {
    const upper = provider.toUpperCase();
    add(`${upper}_CLIENT_ID`, '', true, `${provider} OAuth client id`, true);
    add(`${upper}_CLIENT_SECRET`, '', true, `${provider} OAuth client secret`, true);
    add(
      `${upper}_CALLBACK_URL`,
      `http://localhost:4000/api/v1/auth/oauth/${provider}/callback`,
      true,
      `${provider} OAuth callback URL`,
    );
  }
}

function writePackageJson(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const ext = isTs(c) ? 'ts' : 'js';
  const scripts: Record<string, string> = {
    dev: isTs(c) ? `tsx watch src/server.${ext}` : 'node --watch src/server.js',
    build: isTs(c) ? 'tsc -p tsconfig.json' : 'node -e "process.exit(0)"',
    start: isTs(c) ? 'node dist/server.js' : 'node src/server.js',
    test: c.testing.unit === 'jest' ? 'jest' : 'vitest run',
    typecheck: isTs(c) ? 'tsc --noEmit' : 'node -e "process.exit(0)"',
  };
  if (c.orm === 'prisma') {
    scripts['db:generate'] = 'prisma generate';
    scripts['db:migrate'] = 'prisma migrate dev';
    scripts['db:seed'] = isTs(c) ? 'tsx prisma/seed.ts' : 'node prisma/seed.js';
    scripts['db:studio'] = 'prisma studio';
  }
  if (c.orm === 'drizzle') {
    scripts['db:generate'] = 'drizzle-kit generate';
    scripts['db:migrate'] = 'drizzle-kit migrate';
    scripts['db:push'] = 'drizzle-kit push';
    scripts['db:studio'] = 'drizzle-kit studio';
    scripts['db:seed'] = isTs(c) ? 'tsx src/db/seed.ts' : 'node src/db/seed.js';
  }
  ctx.addScript('dev', scripts.dev ?? 'tsx watch src/server.ts');
  ctx.addScript('build', scripts.build ?? 'tsc -p tsconfig.json');
  ctx.addScript('start', scripts.start ?? 'node dist/server.js');
  ctx.addScript('test', scripts.test ?? 'vitest run');
  ctx.addScript('typecheck', scripts.typecheck ?? 'tsc --noEmit');

  const pkg: Record<string, unknown> = {
    name: apiPkgName(ctx),
    version: '0.1.0',
    private: true,
    type: 'module',
    engines: { node: `>=${c.nodeVersion}` },
    scripts,
  };
  if (c.orm === 'prisma') {
    pkg.prisma = { seed: scripts['db:seed'] };
  }
  writeSrc(ctx, apiPackageJsonPath(ctx), JSON.stringify(pkg, null, 2));
}

function writeTsconfig(ctx: GenerationContextLike): void {
  const p = ctxPaths(ctx);
  const file = p.apiRoot === '.' ? 'tsconfig.json' : `${p.apiRoot}/tsconfig.json`;
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'Node16',
      moduleResolution: 'Node16',
      lib: ['ES2022'],
      strict: true,
      noUncheckedIndexedAccess: true,
      noImplicitOverride: true,
      noFallthroughCasesInSwitch: true,
      skipLibCheck: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      isolatedModules: true,
      declaration: true,
      sourceMap: true,
      outDir: 'dist',
      rootDir: 'src',
      types: ['node'],
    },
    include: ['src'],
    exclude: ['dist', 'node_modules'],
  };
  writeSrc(ctx, file, JSON.stringify(tsconfig, null, 2));
}

function writeVitestConfig(ctx: GenerationContextLike): void {
  const c = ctx.config;
  if (c.testing.unit !== 'vitest') return;
  const p = ctxPaths(ctx);
  const file = p.apiRoot === '.' ? 'vitest.config.ts' : `${p.apiRoot}/vitest.config.ts`;
  const name = isTs(c) ? 'vitest.config.ts' : 'vitest.config.js';
  writeSrc(
    ctx,
    p.apiRoot === '.' ? name : `${p.apiRoot}/${name}`,
    `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.${isTs(c) ? 'ts' : 'js'}', 'tests/**/*.test.${isTs(c) ? 'ts' : 'js'}'],
  },
});
`,
  );
  void file;
}

function writeConfig(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const envFile = p.apiFile('config', 'env');
  const appFile = p.apiFile('config', 'app');
  const dbFile = p.apiFile('config', 'database');
  const authFile = p.apiFile('config', 'auth');
  const indexFile = p.apiFile('config', 'index');

  writeSrc(ctx, envFile, envSource(c));
  writeSrc(
    ctx,
    appFile,
    `import { env } from '${relImport(appFile, envFile)}';

export const appConfig = {
  nodeEnv: env.NODE_ENV,
  port: Number(env.PORT),
  corsOrigin: env.CORS_ORIGIN.split(',').map((item${t(c, ': string')}) => item.trim()),
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  logLevel: env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug'),
  bodyLimit: env.BODY_LIMIT ?? '${JSON_BODY_LIMIT}',
};
`,
  );
  writeSrc(
    ctx,
    dbFile,
    `import { env } from '${relImport(dbFile, envFile)}';

export const databaseConfig = {
  url: env.DATABASE_URL,
};
`,
  );

  if (hasAuth(c) || needsJwtSecret(c) || hasSession(c)) {
    writeSrc(ctx, authFile, authConfigSource(c, relImport(authFile, envFile)));
  }

  const exports = [
    `export { env } from '${relImport(indexFile, envFile)}';`,
    `export { appConfig } from '${relImport(indexFile, appFile)}';`,
    `export { databaseConfig } from '${relImport(indexFile, dbFile)}';`,
  ];
  if (hasAuth(c) || needsJwtSecret(c) || hasSession(c)) {
    exports.push(`export { authConfig } from '${relImport(indexFile, authFile)}';`);
  }
  writeSrc(ctx, indexFile, `${exports.join('\n')}\n`);
}

function envSource(c: StarterConfig): string {
  const fields: Array<{ key: string; zod: string; yup: string; joi: string; valibot: string }> = [
    {
      key: 'NODE_ENV',
      zod: `z.enum(['development', 'test', 'production']).default('development')`,
      yup: `yup.string().oneOf(['development', 'test', 'production']).default('development')`,
      joi: `Joi.string().valid('development', 'test', 'production').default('development')`,
      valibot: `v.optional(v.picklist(['development', 'test', 'production']), 'development')`,
    },
    {
      key: 'PORT',
      zod: `z.coerce.number().int().positive().default(4000)`,
      yup: `yup.number().transform((_, v) => Number(v)).positive().default(4000)`,
      joi: `Joi.number().integer().positive().default(4000)`,
      valibot: `v.optional(v.pipe(v.string(), v.transform(Number)), '4000')`,
    },
    {
      key: 'DATABASE_URL',
      zod: `z.string().min(1)`,
      yup: `yup.string().required()`,
      joi: `Joi.string().required()`,
      valibot: `v.pipe(v.string(), v.minLength(1))`,
    },
    {
      key: 'CORS_ORIGIN',
      zod: `z.string().min(1)`,
      yup: `yup.string().required()`,
      joi: `Joi.string().required()`,
      valibot: `v.pipe(v.string(), v.minLength(1))`,
    },
    {
      key: 'LOG_LEVEL',
      zod: `z.string().optional()`,
      yup: `yup.string().optional()`,
      joi: `Joi.string().optional()`,
      valibot: `v.optional(v.string())`,
    },
    {
      key: 'BODY_LIMIT',
      zod: `z.string().optional()`,
      yup: `yup.string().optional()`,
      joi: `Joi.string().optional()`,
      valibot: `v.optional(v.string())`,
    },
  ];

  if (needsJwtSecret(c)) {
    fields.push(
      {
        key: 'JWT_SECRET',
        zod: `z.string().min(32)`,
        yup: `yup.string().min(32).required()`,
        joi: `Joi.string().min(32).required()`,
        valibot: `v.pipe(v.string(), v.minLength(32))`,
      },
      {
        key: 'JWT_ACCESS_EXPIRES',
        zod: `z.string().default('${ACCESS_TOKEN_TTL}')`,
        yup: `yup.string().default('${ACCESS_TOKEN_TTL}')`,
        joi: `Joi.string().default('${ACCESS_TOKEN_TTL}')`,
        valibot: `v.optional(v.string(), '${ACCESS_TOKEN_TTL}')`,
      },
    );
  }
  if (hasRefresh(c)) {
    fields.push(
      {
        key: 'JWT_REFRESH_SECRET',
        zod: `z.string().min(32)`,
        yup: `yup.string().min(32).required()`,
        joi: `Joi.string().min(32).required()`,
        valibot: `v.pipe(v.string(), v.minLength(32))`,
      },
      {
        key: 'JWT_REFRESH_EXPIRES',
        zod: `z.string().default('${REFRESH_TOKEN_TTL_DAYS}d')`,
        yup: `yup.string().default('${REFRESH_TOKEN_TTL_DAYS}d')`,
        joi: `Joi.string().default('${REFRESH_TOKEN_TTL_DAYS}d')`,
        valibot: `v.optional(v.string(), '${REFRESH_TOKEN_TTL_DAYS}d')`,
      },
    );
  }
  if (hasSession(c)) {
    fields.push(
      {
        key: 'SESSION_SECRET',
        zod: `z.string().min(32)`,
        yup: `yup.string().min(32).required()`,
        joi: `Joi.string().min(32).required()`,
        valibot: `v.pipe(v.string(), v.minLength(32))`,
      },
      {
        key: 'SESSION_NAME',
        zod: `z.string().default('sid')`,
        yup: `yup.string().default('sid')`,
        joi: `Joi.string().default('sid')`,
        valibot: `v.optional(v.string(), 'sid')`,
      },
    );
  }
  if (needsRedis(c)) {
    fields.push({
      key: 'REDIS_URL',
      zod: `z.string().min(1)`,
      yup: `yup.string().required()`,
      joi: `Joi.string().required()`,
      valibot: `v.pipe(v.string(), v.minLength(1))`,
    });
  }
  if (hasOpenApi(c)) {
    fields.push({
      key: 'ENABLE_API_DOCS',
      zod: `z.enum(['true', 'false']).optional()`,
      yup: `yup.string().oneOf(['true', 'false']).optional()`,
      joi: `Joi.string().valid('true', 'false').optional()`,
      valibot: `v.optional(v.picklist(['true', 'false']))`,
    });
  }
  for (const provider of c.oauthProviders) {
    const upper = provider.toUpperCase();
    fields.push(
      {
        key: `${upper}_CLIENT_ID`,
        zod: `z.string().min(1)`,
        yup: `yup.string().required()`,
        joi: `Joi.string().required()`,
        valibot: `v.pipe(v.string(), v.minLength(1))`,
      },
      {
        key: `${upper}_CLIENT_SECRET`,
        zod: `z.string().min(1)`,
        yup: `yup.string().required()`,
        joi: `Joi.string().required()`,
        valibot: `v.pipe(v.string(), v.minLength(1))`,
      },
      {
        key: `${upper}_CALLBACK_URL`,
        zod: `z.string().url()`,
        yup: `yup.string().url().required()`,
        joi: `Joi.string().uri().required()`,
        valibot: `v.pipe(v.string(), v.url())`,
      },
    );
  }
  if (c.monitoring.includes('sentry')) {
    fields.push({
      key: 'SENTRY_DSN',
      zod: `z.string().optional()`,
      yup: `yup.string().optional()`,
      joi: `Joi.string().optional()`,
      valibot: `v.optional(v.string())`,
    });
  }
  if (c.payments.includes('stripe')) {
    fields.push(
      {
        key: 'STRIPE_SECRET_KEY',
        zod: `z.string().min(1)`,
        yup: `yup.string().required()`,
        joi: `Joi.string().required()`,
        valibot: `v.pipe(v.string(), v.minLength(1))`,
      },
      {
        key: 'STRIPE_WEBHOOK_SECRET',
        zod: `z.string().min(1)`,
        yup: `yup.string().required()`,
        joi: `Joi.string().required()`,
        valibot: `v.pipe(v.string(), v.minLength(1))`,
      },
    );
  }
  if (c.email === 'smtp') {
    fields.push(
      { key: 'SMTP_HOST', zod: `z.string().min(1)`, yup: `yup.string().required()`, joi: `Joi.string().required()`, valibot: `v.pipe(v.string(), v.minLength(1))` },
      { key: 'SMTP_PORT', zod: `z.string().optional()`, yup: `yup.string().optional()`, joi: `Joi.string().optional()`, valibot: `v.optional(v.string())` },
      { key: 'SMTP_USER', zod: `z.string().optional()`, yup: `yup.string().optional()`, joi: `Joi.string().optional()`, valibot: `v.optional(v.string())` },
      { key: 'SMTP_PASS', zod: `z.string().optional()`, yup: `yup.string().optional()`, joi: `Joi.string().optional()`, valibot: `v.optional(v.string())` },
      { key: 'SMTP_FROM', zod: `z.string().optional()`, yup: `yup.string().optional()`, joi: `Joi.string().optional()`, valibot: `v.optional(v.string())` },
    );
  }
  if (c.email === 'resend') {
    fields.push({
      key: 'RESEND_API_KEY',
      zod: `z.string().min(1)`,
      yup: `yup.string().required()`,
      joi: `Joi.string().required()`,
      valibot: `v.pipe(v.string(), v.minLength(1))`,
    });
  }
  if (c.storage === 's3' || c.storage === 'r2' || c.storage === 'minio') {
    fields.push(
      { key: 'S3_BUCKET', zod: `z.string().min(1)`, yup: `yup.string().required()`, joi: `Joi.string().required()`, valibot: `v.pipe(v.string(), v.minLength(1))` },
      { key: 'S3_REGION', zod: `z.string().optional()`, yup: `yup.string().optional()`, joi: `Joi.string().optional()`, valibot: `v.optional(v.string())` },
      { key: 'S3_ENDPOINT', zod: `z.string().optional()`, yup: `yup.string().optional()`, joi: `Joi.string().optional()`, valibot: `v.optional(v.string())` },
      { key: 'S3_ACCESS_KEY', zod: `z.string().min(1)`, yup: `yup.string().required()`, joi: `Joi.string().required()`, valibot: `v.pipe(v.string(), v.minLength(1))` },
      { key: 'S3_SECRET_KEY', zod: `z.string().min(1)`, yup: `yup.string().required()`, joi: `Joi.string().required()`, valibot: `v.pipe(v.string(), v.minLength(1))` },
    );
  }

  return `import 'dotenv/config';
${validationImport(c)}
const envSchema = ${envSchemaExpr(c, fields)};

export const env = ${parseEnvCall(c)};
`;
}

function authConfigSource(c: StarterConfig, envImport: string): string {
  const jwt = needsJwtSecret(c)
    ? `
  jwtSecret: env.JWT_SECRET,
  accessTtl: env.JWT_ACCESS_EXPIRES ?? '${ACCESS_TOKEN_TTL}',`
    : '';
  const refresh = hasRefresh(c)
    ? `
  refreshSecret: env.JWT_REFRESH_SECRET,
  refreshTtl: env.JWT_REFRESH_EXPIRES ?? '${REFRESH_TOKEN_TTL_DAYS}d',`
    : '';
  const session = hasSession(c)
    ? `
  sessionSecret: env.SESSION_SECRET,
  sessionName: env.SESSION_NAME ?? 'sid',`
    : '';

  return `import { env } from '${envImport}';

export const authConfig = {
  cookieSecure: env.NODE_ENV === 'production',
  accessCookie: 'access_token',
  refreshCookie: 'refresh_token',
  lockoutAttempts: ${5},
  lockoutMinutes: ${15},${jwt}${refresh}${session}
};
`;
}

function writeLogger(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('lib', 'logger');
  const envFile = p.apiFile('config', 'env');
  const appCfg = p.apiFile('config', 'app');
  const redact =
    "['password', 'token', 'authorization', 'cookie', 'secret', '*.password', '*.token', '*.authorization', '*.cookie', '*.secret', 'req.headers.authorization', 'req.headers.cookie']";

  if (c.logging === 'winston') {
    writeSrc(
      ctx,
      file,
      `import winston from 'winston';
import { appConfig } from '${relImport(file, appCfg)}';

const redactKeys = new Set(['password', 'token', 'authorization', 'cookie', 'secret', 'accesstoken', 'refreshtoken']);

function redactValue(key${t(c, ': string')}, value${t(c, ': unknown')})${ret(c, 'unknown')} {
  if (redactKeys.has(key.toLowerCase())) return '[Redacted]';
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const out${t(c, ': Record<string, unknown>')} = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactValue(k, v);
    return out;
  }
  return value;
}

export const logger = winston.createLogger({
  level: appConfig.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => JSON.stringify(redactValue('root', info))),
  ),
  transports: [new winston.transports.Console()],
});
`,
    );
    return;
  }

  writeSrc(
    ctx,
    file,
    `import pino from 'pino';
import { env } from '${relImport(file, envFile)}';
import { appConfig } from '${relImport(file, appCfg)}';

export const logger = pino({
  level: appConfig.logLevel,
  redact: {
    paths: ${redact},
    censor: '[Redacted]',
  },
  transport: env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined,
});
`,
  );
}

function writeUtils(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const responseFile = p.apiFile('utils', 'api-response');
  const asyncFile = p.apiFile('utils', 'async-handler');
  const pageFile = p.apiFile('utils', 'pagination');
  const http = httpTypes(c);

  writeSrc(
    ctx,
    responseFile,
    `${exportOkTypes(c)}export function ok(data${t(c, ': unknown')}, meta${t(c, '?: Record<string, unknown>')}) {
  return meta ? { success: true${t(c, ' as const')}, data, meta } : { success: true${t(c, ' as const')}, data };
}

export function created(data${t(c, ': unknown')}) {
  return { success: true${t(c, ' as const')}, data };
}

export function fail(code${t(c, ': string')}, message${t(c, ': string')}, details${t(c, '?: unknown')}) {
  return {
    success: false${t(c, ' as const')},
    error: details === undefined ? { code, message } : { code, message, details },
  };
}
`,
  );

  if (isExpress(c)) {
    writeSrc(
      ctx,
      asyncFile,
      `${http.importLine}${typeImport(
        c,
        `type AsyncRoute = (req: Request, res: Response, next: NextFunction) => unknown | Promise<unknown>;\n`,
      )}export function asyncHandler(fn${t(c, ': AsyncRoute')}) {
  return (${params(c, [
    ['req', 'Request'],
    ['res', 'Response'],
    ['next', 'NextFunction'],
  ])}) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
`,
    );
  } else {
    writeSrc(
      ctx,
      asyncFile,
      `export function asyncHandler(fn${t(c, ': (...args: never[]) => unknown')}) {
  return fn;
}
`,
    );
  }

  const offset = `
export function parseOffset(query${t(c, ': Record<string, unknown>')}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function offsetMeta(page${t(c, ': number')}, limit${t(c, ': number')}, total${t(c, ': number')}) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}
`;

  const cursor =
    c.pagination !== 'offset'
      ? `
export function parseCursor(query${t(c, ': Record<string, unknown>')}) {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const cursor = typeof query.cursor === 'string' && query.cursor.length > 0 ? query.cursor : null;
  return { cursor, limit, take: limit + 1 };
}

export function cursorResult(items${t(c, ': Array<{ id: string }>')}, limit${t(c, ': number')}) {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const last = data[data.length - 1];
  return { data, meta: { nextCursor: hasMore && last ? last.id : null, limit } };
}
`
      : '';

  writeSrc(ctx, pageFile, `${offset}${cursor}`);
}

function exportOkTypes(c: StarterConfig): string {
  return interfaceBlock(
    c,
    `export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}
`,
  );
}

function writeHttpTypes(ctx: GenerationContextLike): void {
  const c = ctx.config;
  if (!isTs(c)) return;
  const p = ctxPaths(ctx);
  const file = p.apiFile('types', 'http');
  writeSrc(
    ctx,
    file,
    `export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  tenantId?: string;
}
`,
  );

  const aug = p.apiSrc('types/express.d.ts');
  if (isExpress(c)) {
    writeSrc(
      ctx,
      aug,
      `import type { AuthUser } from './http.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthUser;
      rawBody?: Buffer;
    }
  }
}

export {};
`,
    );
  } else {
    writeSrc(
      ctx,
      p.apiSrc('types/fastify.d.ts'),
      `import type { AuthUser } from './http.js';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
    user?: AuthUser;
    rawBody?: Buffer;
  }
}

export {};
`,
    );
  }
}

function writeMiddlewares(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const http = httpTypes(c);
  const reqIdFile = p.apiFile('middleware', 'request-id');
  const validateFile = p.apiFile('middleware', 'validate');
  const rateFile = p.apiFile('middleware', 'rate-limit');
  const loggerFile = p.apiFile('lib', 'logger');
  const errorsFile = p.apiFile('errors', 'index');
  const envFile = p.apiFile('config', 'env');

  writeSrc(ctx, reqIdFile, requestIdSource(c, http));
  writeSrc(
    ctx,
    validateFile,
    validateSource(c, http, relImport(validateFile, errorsFile)),
  );
  writeSrc(
    ctx,
    rateFile,
    rateLimitSource(c, relImport(rateFile, errorsFile)),
  );

  const httpLoggerFile = p.apiFile('middleware', 'http-logger');
  writeSrc(ctx, httpLoggerFile, httpLoggerSource(c, http, relImport(httpLoggerFile, loggerFile), relImport(httpLoggerFile, envFile)));

  const handlerFile = p.apiFile('middleware', 'error-handler');
  const notFoundFile = p.apiFile('middleware', 'not-found');
  writeSrc(
    ctx,
    handlerFile,
    `${http.importLine}import { fail } from '${relImport(handlerFile, p.apiFile('utils', 'api-response'))}';
import { env } from '${relImport(handlerFile, envFile)}';
import { logger } from '${relImport(handlerFile, loggerFile)}';
export function errorHandler(${isExpress(c) ? params(c, [['err', 'Error'], ['req', 'Request'], ['res', 'Response'], ['_next', 'NextFunction']]) : `error${t(c, ': Error')}, request${t(c, ': FastifyRequest')}, reply${t(c, ': FastifyReply')}`}) {
  logger.error({ err: { name: ${isExpress(c) ? 'err' : 'error'}.name, message: ${isExpress(c) ? 'err' : 'error'}.message } }, 'unhandled_error');
  const body = fail('INTERNAL_ERROR', env.NODE_ENV === 'production' ? 'An unexpected error occurred' : ${isExpress(c) ? 'err' : 'error'}.message);
  ${isExpress(c) ? 'res.status(500).json(body);' : 'return reply.status(500).send(body);'}
}
`,
  );
  writeSrc(
    ctx,
    notFoundFile,
    `${http.importLine}export function notFoundHandler(${isExpress(c) ? params(c, [['req', 'Request'], ['_res', 'Response'], ['next', 'NextFunction']]) : `request${t(c, ': FastifyRequest')}`}) {
  ${isExpress(c) ? "next(Object.assign(new Error(`Route ${req.method} ${req.originalUrl} not found`), { statusCode: 404, code: 'NOT_FOUND' }));" : "throw Object.assign(new Error(`Route ${request.method} ${request.url} not found`), { statusCode: 404, code: 'NOT_FOUND' });"}
}
`,
  );
}

function requestIdSource(
  c: StarterConfig,
  http: ReturnType<typeof httpTypes>,
): string {
  if (isFastify(c)) {
    return `import { randomUUID } from 'node:crypto';
${http.importLine}
export async function requestId(request${t(c, ': FastifyRequest')}, reply${t(c, ': FastifyReply')}) {
  const header = request.headers['x-request-id'];
  const id = typeof header === 'string' && header.length > 0 ? header : randomUUID();
  request.requestId = id;
  reply.header('x-request-id', id);
}
`;
  }
  return `import { randomUUID } from 'node:crypto';
${http.importLine}
export function requestId(
  ${params(c, [
    ['req', 'Request'],
    ['res', 'Response'],
    ['next', 'NextFunction'],
  ])},
)${ret(c, 'void')} {
  const header = req.headers['x-request-id'];
  const id = typeof header === 'string' && header.length > 0 ? header : randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
`;
}

function validateSource(
  c: StarterConfig,
  http: ReturnType<typeof httpTypes>,
  errorsImport: string,
): string {
  const lib = c.validation;
  if (isFastify(c)) {
    return `import { ValidationError } from '${errorsImport}';
${validationImport(c)}${http.importLine}
export function validate(schema${t(c, ': unknown')}) {
  return async (request${t(c, ': FastifyRequest')}) => {
    const payload = { body: request.body, query: request.query, params: request.params };
    ${validateParse(c, lib, 'payload', 'request')}
  };
}
`;
  }
  return `${http.importLine}import { ValidationError } from '${errorsImport}';
${validationImport(c)}
export function validate(schema${t(c, ': unknown')}) {
  return (${params(c, [
    ['req', 'Request'],
    ['_res', 'Response'],
    ['next', 'NextFunction'],
  ])}) => {
    const payload = { body: req.body, query: req.query, params: req.params };
    try {
      ${validateParse(c, lib, 'payload', 'req')}
      next();
    } catch (error) {
      next(error);
    }
  };
}
`;
}

function validateParse(c: StarterConfig, lib: StarterConfig['validation'], payload: string, target: string): string {
  if (lib === 'yup') {
    return `const parsed = schema.validateSync(${payload}, { abortEarly: false, stripUnknown: true });
      ${target}.body = parsed.body ?? ${target}.body;
      ${target}.query = parsed.query ?? ${target}.query;
      ${target}.params = parsed.params ?? ${target}.params;`;
  }
  if (lib === 'joi') {
    return `const result = schema.validate(${payload}, { abortEarly: false, stripUnknown: true });
      if (result.error) throw new ValidationError('Validation failed', result.error.details);
      ${target}.body = result.value.body ?? ${target}.body;
      ${target}.query = result.value.query ?? ${target}.query;
      ${target}.params = result.value.params ?? ${target}.params;`;
  }
  if (lib === 'valibot') {
    return `const parsed = v.parse(schema, ${payload});
      ${target}.body = parsed.body ?? ${target}.body;
      ${target}.query = parsed.query ?? ${target}.query;
      ${target}.params = parsed.params ?? ${target}.params;`;
  }
  return `const parsed = ${t(c, '(schema as { safeParse: (value: unknown) => { success: boolean; data?: { body?: unknown; query?: unknown; params?: unknown }; error?: { flatten: () => unknown } } })', 'schema')}.safeParse(${payload});
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten());
      ${target}.body = parsed.data.body ?? ${target}.body;
      ${target}.query = parsed.data.query ?? ${target}.query;
      ${target}.params = parsed.data.params ?? ${target}.params;`;
}

function rateLimitSource(c: StarterConfig, errorsImport: string): string {
  if (isFastify(c)) {
    return `export const generalRateLimit = { max: ${GENERAL_RATE_MAX}, timeWindow: '1 minute' };
export const authRateLimit = { max: ${AUTH_RATE_MAX}, timeWindow: '1 minute' };
export const sensitiveRateLimit = { max: ${SENSITIVE_RATE_MAX}, timeWindow: '1 minute' };
`;
  }
  return `import rateLimit from 'express-rate-limit';
import { RateLimitError } from '${errorsImport}';

function limiter(max${t(c, ': number')}, prefix${t(c, ': string')}) {
  return rateLimit({
    windowMs: 60_000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health' || req.path === '/ready',
    handler: (_req, _res, next) => next(new RateLimitError()),
    keyGenerator: (req) => \`\${prefix}:\${req.ip ?? 'unknown'}\`,
  });
}

export const generalLimiter = limiter(${GENERAL_RATE_MAX}, 'general');
export const authLimiter = limiter(${AUTH_RATE_MAX}, 'auth');
export const sensitiveLimiter = limiter(${SENSITIVE_RATE_MAX}, 'sensitive');
`;
}

function httpLoggerSource(
  c: StarterConfig,
  http: ReturnType<typeof httpTypes>,
  loggerImport: string,
  _envImport: string,
): string {
  if (c.logging === 'pino' && isExpress(c)) {
    return `import pinoHttp from 'pino-http';
import { logger } from '${loggerImport}';

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.requestId,
  customProps: (req) => ({ requestId: req.requestId }),
  serializers: {
    req(req) {
      return { id: req.id, method: req.method, url: req.url };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
  },
});
`;
  }
  if (isFastify(c)) {
    return `export function httpLogger() {
  return;
}
`;
  }
  return `${http.importLine}import { logger } from '${loggerImport}';

export function httpLogger(
  ${params(c, [
    ['req', 'Request'],
    ['res', 'Response'],
    ['next', 'NextFunction'],
  ])},
)${ret(c, 'void')} {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
      },
      'request',
    );
  });
  next();
}
`;
}

function writeHealth(ctx: GenerationContextLike): void {
  if (!hasHealth(ctx.config)) return;
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('routes', 'health');
  const responseFile = p.apiFile('utils', 'api-response');
  const asyncFile = p.apiFile('utils', 'async-handler');
  const dbFile = p.apiFile('lib', 'db');
  const errorsFile = p.apiFile('errors', 'index');
  const appFile = p.apiSrc(fileName(c, 'app'));
  const http = httpTypes(c);

  writeSrc(ctx, file, healthRouteSource(c, http, {
    response: relImport(file, responseFile),
    asyncH: relImport(file, asyncFile),
    db: relImport(file, dbFile),
    errors: relImport(file, errorsFile),
  }));

  ctx.addRoute({
    name: 'health',
    importStatement: `import { healthRouter } from '${relImport(appFile, file)}';`,
    mountPath: '/',
    routerIdentifier: 'healthRouter',
    order: 10,
  });
}

function healthRouteSource(
  c: StarterConfig,
  http: ReturnType<typeof httpTypes>,
  imports: { response: string; asyncH: string; db: string; errors: string },
): string {
  if (isFastify(c)) {
    return `import { ok } from '${imports.response}';
import { pingDb } from '${imports.db}';
import { AppError } from '${imports.errors}';
${typeImport(c, `import type { FastifyInstance } from 'fastify';\n`)}
export async function healthRouter(app${t(c, ': FastifyInstance')}) {
  app.get('/health', async () => ok({ status: 'ok', uptime: process.uptime() }));
  app.get('/ready', async () => {
    const database = await pingDb();
    if (!database) throw new AppError('Database unavailable', 503, 'INTERNAL_ERROR');
    return ok({ status: 'ready', checks: { database } });
  });
}
`;
  }
  return `import { Router } from 'express';
import { ok } from '${imports.response}';
import { asyncHandler } from '${imports.asyncH}';
import { pingDb } from '${imports.db}';
import { AppError } from '${imports.errors}';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json(ok({ status: 'ok', uptime: process.uptime() }));
});

healthRouter.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const database = await pingDb();
    if (!database) throw new AppError('Database unavailable', 503, 'INTERNAL_ERROR');
    res.json(ok({ status: 'ready', checks: { database } }));
  }),
);
`;
  void http;
}

function writeV1Placeholder(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiSrc(`routes/v1/${fileName(c, 'index')}`);
  if (isFastify(c)) {
    writeSrc(
      ctx,
      file,
      `${typeImport(c, `import type { FastifyInstance } from 'fastify';\n`)}export async function v1Router(_app${t(c, ': FastifyInstance')}) {}
`,
    );
  } else {
    writeSrc(
      ctx,
      file,
      `import { Router } from 'express';

export const v1Router = Router();
`,
    );
  }
}

function writeGraphql(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const schemaFile = p.apiSrc(`graphql/${fileName(c, 'schema')}`);
  const serverFile = p.apiSrc(`graphql/${fileName(c, 'server')}`);
  const appFile = p.apiSrc(fileName(c, 'app'));
  const envFile = p.apiFile('config', 'env');

  writeSrc(
    ctx,
    schemaFile,
    `export const typeDefs = /* GraphQL */ \`
  type Query {
    health: String!
  }
\`;

export const resolvers = {
  Query: {
    health: () => 'ok',
  },
};
`,
  );

  const introspectionOff = `env.NODE_ENV !== 'production'`;

  if (graphqlServer(c) === 'yoga') {
    writeSrc(
      ctx,
      serverFile,
      `import { createSchema, createYoga } from 'graphql-yoga';
import { env } from '${relImport(serverFile, envFile)}';
import { typeDefs, resolvers } from '${relImport(serverFile, schemaFile)}';

export const yoga = createYoga({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: '/graphql',
  graphiql: ${introspectionOff},
  landingPage: false,
});
`,
    );
    ctx.addRoute({
      name: 'graphql',
      importStatement: `import { yoga } from '${relImport(appFile, serverFile)}';`,
      mountPath: '/graphql',
      routerIdentifier: 'yoga',
      order: 200,
    });
    return;
  }

  writeSrc(
    ctx,
    serverFile,
    `import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { env } from '${relImport(serverFile, envFile)}';
import { typeDefs, resolvers } from '${relImport(serverFile, schemaFile)}';

export async function createGraphqlServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: ${introspectionOff},
    plugins: [
      env.NODE_ENV === 'production'
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
  });
  await server.start();
  return server;
}
`,
  );
  ctx.addNote('GraphQL is mounted at /graphql. Docs/introspection are disabled in production.');
}

function writeOpenApi(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const paths: string[] = [
    `  /health:
    get:
      summary: Liveness
      responses:
        '200':
          description: OK`,
    `  /ready:
    get:
      summary: Readiness
      responses:
        '200':
          description: Ready`,
  ];
  if (hasAuth(c)) {
    paths.push(`  /api/v1/auth/register:
    post:
      summary: Register
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email: { type: string, format: email }
                password: { type: string, minLength: 8 }
                name: { type: string }
      responses:
        '201': { description: Created }
  /api/v1/auth/login:
    post:
      summary: Login
      responses:
        '200': { description: OK }
  /api/v1/auth/logout:
    post:
      summary: Logout
      responses:
        '200': { description: OK }`);
    if (hasRefresh(c) || hasJwt(c)) {
      paths.push(`  /api/v1/auth/refresh:
    post:
      summary: Rotate refresh token
      responses:
        '200': { description: OK }`);
    }
  }

  writeSrc(
    ctx,
    'docs/openapi.yaml',
    `openapi: 3.0.3
info:
  title: ${c.name} API
  version: 1.0.0
servers:
  - url: /
paths:
${paths.join('\n')}
`,
  );

  if (!hasSwaggerUi(c)) return;

  const p = ctxPaths(ctx);
  const docsFile = p.apiFile('routes', 'docs');
  const appFile = p.apiSrc(fileName(c, 'app'));
  const envFile = p.apiFile('config', 'env');

  if (isExpress(c)) {
    writeSrc(
      ctx,
      docsFile,
      `import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { env } from '${relImport(docsFile, envFile)}';

const specPath = resolve(dirname(fileURLToPath(import.meta.url)), '${relAsset(docsFile, 'docs/openapi.yaml')}');
const spec = YAML.parse(readFileSync(specPath, 'utf8'));

export const docsRouter = Router();
docsRouter.use((_req, res, next) => {
  if (env.NODE_ENV === 'production' && env.ENABLE_API_DOCS !== 'true') {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
    return;
  }
  next();
});
docsRouter.use('/', swaggerUi.serve, swaggerUi.setup(spec));
`,
    );
    ctx.addRoute({
      name: 'docs',
      importStatement: `import { docsRouter } from '${relImport(appFile, docsFile)}';`,
      mountPath: '/api/docs',
      routerIdentifier: 'docsRouter',
      order: 300,
    });
  } else {
    writeSrc(
      ctx,
      docsFile,
      `${typeImport(c, `import type { FastifyInstance } from 'fastify';\n`)}import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from '${relImport(docsFile, envFile)}';

export async function docsRouter(app${t(c, ': FastifyInstance')}) {
  if (env.NODE_ENV === 'production' && env.ENABLE_API_DOCS !== 'true') return;
  await app.register(swagger, { openapi: { info: { title: '${c.name} API', version: '1.0.0' } } });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });
}
`,
    );
    ctx.addRoute({
      name: 'docs',
      importStatement: `import { docsRouter } from '${relImport(appFile, docsFile)}';`,
      mountPath: '/',
      routerIdentifier: 'docsRouter',
      order: 300,
    });
  }
}

function writeApp(ctx: GenerationContextLike): void {
  writeSrc(ctx, appFilePath(ctx), renderApp(ctx, ctx.middlewares, ctx.routes));
}

function writeServer(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const serverFile = p.apiSrc(fileName(c, 'server'));
  const appFile = p.apiSrc(fileName(c, 'app'));
  const loggerFile = p.apiFile('lib', 'logger');
  const appCfg = p.apiFile('config', 'app');
  const dbFile = p.apiFile('lib', 'db');

  if (isFastify(c)) {
    writeSrc(
      ctx,
      serverFile,
      `import { createApp } from '${relImport(serverFile, appFile)}';
import { logger } from '${relImport(serverFile, loggerFile)}';
import { appConfig } from '${relImport(serverFile, appCfg)}';
import { closeDb } from '${relImport(serverFile, dbFile)}';

const app = await createApp();
await app.listen({ port: appConfig.port, host: '0.0.0.0' });
logger.info({ port: appConfig.port }, 'listening');

async function shutdown(signal${t(c, ': string')}) {
  logger.info({ signal }, 'shutting_down');
  try {
    await app.close();
    await closeDb();
    process.exit(0);
  } catch (error) {
    logger.error({ err: { message: error instanceof Error ? error.message : 'shutdown_failed' } }, 'shutdown_error');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
`,
    );
    return;
  }

  writeSrc(
    ctx,
    serverFile,
    `import { createApp } from '${relImport(serverFile, appFile)}';
import { logger } from '${relImport(serverFile, loggerFile)}';
import { appConfig } from '${relImport(serverFile, appCfg)}';
import { closeDb } from '${relImport(serverFile, dbFile)}';

const app = await createApp();
const server = app.listen(appConfig.port, () => {
  logger.info({ port: appConfig.port }, 'listening');
});

async function shutdown(signal${t(c, ': string')}) {
  logger.info({ signal }, 'shutting_down');
  server.close(async () => {
    try {
      await closeDb();
      process.exit(0);
    } catch (error) {
      logger.error({ err: { message: error instanceof Error ? error.message : 'shutdown_failed' } }, 'shutdown_error');
      process.exit(1);
    }
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
`,
  );
}

function registerCoreMiddleware(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const appFile = appFilePath(ctx);
  const reqId = p.apiFile('middleware', 'request-id');
  const httpLogger = p.apiFile('middleware', 'http-logger');
  const rateFile = p.apiFile('middleware', 'rate-limit');
  const appCfg = p.apiFile('config', 'app');
  const handlerFile = p.apiFile('middleware', 'error-handler');
  const notFoundFile = p.apiFile('middleware', 'not-found');
  const v1File = p.apiSrc(`routes/v1/${fileName(c, 'index')}`);

  const add = (reg: MiddlewareRegistration) => ctx.addMiddleware(reg);

  add({
    name: 'request-id',
    importStatement: `import { requestId } from '${relImport(appFile, reqId)}';`,
    useStatement: isExpress(c) ? 'app.use(requestId);' : 'app.addHook(\'onRequest\', requestId);',
    order: 10,
  });

  if (isExpress(c)) {
    add({
      name: 'helmet',
      importStatement: `import helmet from 'helmet';`,
      useStatement: 'app.use(helmet());',
      order: 20,
    });
    add({
      name: 'cors',
      importStatement: `import cors from 'cors';\nimport { appConfig } from '${relImport(appFile, appCfg)}';`,
      useStatement: 'app.use(cors({ origin: appConfig.corsOrigin, credentials: true }));',
      order: 30,
    });
    add({
      name: 'cookie-parser',
      importStatement: `import cookieParser from 'cookie-parser';`,
      useStatement: 'app.use(cookieParser());',
      order: 35,
    });
    if (c.payments.includes('stripe')) {
      add({
        name: 'stripe-raw-body',
        importStatement: '',
        useStatement:
          "app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }), (req, _res, next) => { req.rawBody = req.body; next(); });",
        order: 39,
      });
    }
    add({
      name: 'json-parser',
      importStatement: `import { appConfig } from '${relImport(appFile, appCfg)}';`,
      useStatement: c.payments.includes('stripe')
        ? `app.use((req, res, next) => { if (req.originalUrl === '/api/v1/payments/webhook') return next(); return express.json({ limit: appConfig.bodyLimit })(req, res, next); });`
        : `app.use(express.json({ limit: appConfig.bodyLimit }));`,
      order: 40,
    });
    add({
      name: 'urlencoded',
      importStatement: '',
      useStatement: `app.use(express.urlencoded({ extended: false, limit: appConfig.bodyLimit }));`,
      order: 45,
    });
    add({
      name: 'http-logger',
      importStatement: `import { httpLogger } from '${relImport(appFile, httpLogger)}';`,
      useStatement: 'app.use(httpLogger);',
      order: 50,
    });
    add({
      name: 'rate-limit',
      importStatement: `import { generalLimiter } from '${relImport(appFile, rateFile)}';`,
      useStatement: 'app.use(generalLimiter);',
      order: 60,
    });
    add({
      name: 'not-found',
      importStatement: `import { notFoundHandler } from '${relImport(appFile, notFoundFile)}';`,
      useStatement: 'app.use(notFoundHandler);',
      order: 900,
    });
    add({
      name: 'error-handler',
      importStatement: `import { errorHandler } from '${relImport(appFile, handlerFile)}';`,
      useStatement: 'app.use(errorHandler);',
      order: 1000,
    });
  } else {
    add({
      name: 'helmet',
      importStatement: `import helmet from '@fastify/helmet';`,
      useStatement: 'await app.register(helmet);',
      order: 20,
    });
    add({
      name: 'cors',
      importStatement: `import cors from '@fastify/cors';\nimport { appConfig } from '${relImport(appFile, appCfg)}';`,
      useStatement: 'await app.register(cors, { origin: appConfig.corsOrigin, credentials: true });',
      order: 30,
    });
    add({
      name: 'cookie',
      importStatement: `import cookie from '@fastify/cookie';`,
      useStatement: 'await app.register(cookie);',
      order: 35,
    });
    add({
      name: 'rate-limit',
      importStatement: `import rateLimit from '@fastify/rate-limit';\nimport { generalRateLimit } from '${relImport(appFile, rateFile)}';`,
      useStatement: 'await app.register(rateLimit, generalRateLimit);',
      order: 60,
    });
    add({
      name: 'not-found',
      importStatement: `import { notFoundHandler } from '${relImport(appFile, notFoundFile)}';`,
      useStatement: 'app.setNotFoundHandler(notFoundHandler);',
      order: 900,
    });
    add({
      name: 'error-handler',
      importStatement: `import { errorHandler } from '${relImport(appFile, handlerFile)}';`,
      useStatement: 'app.setErrorHandler(errorHandler);',
      order: 1000,
    });
  }

  if (hasRest(c) || !hasGraphql(c) || hasAuth(c) || hasHealth(c)) {
    ctx.addRoute({
      name: 'v1',
      importStatement: `import { v1Router } from '${relImport(appFile, v1File)}';`,
      mountPath: '/api/v1',
      routerIdentifier: 'v1Router',
      order: 100,
    });
  }
}

function appFilePath(ctx: GenerationContextLike): string {
  return ctxPaths(ctx).apiSrc(fileName(ctx.config, 'app'));
}

function isAppLevelRoute(route: RouteRegistration): boolean {
  return (
    route.name === 'health' ||
    route.name === 'v1' ||
    route.name === 'graphql' ||
    route.name === 'docs' ||
    route.name === 'metrics' ||
    route.mountPath.startsWith('/health') ||
    route.mountPath.startsWith('/ready') ||
    route.mountPath.startsWith('/graphql') ||
    route.mountPath.startsWith('/api/docs') ||
    route.mountPath.startsWith('/metrics')
  );
}

function assembleV1(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiSrc(`routes/v1/${fileName(c, 'index')}`);
  const moduleRoutes = sortByOrder(ctx.routes.filter((route) => !isAppLevelRoute(route)));
  const imports = uniqueImports(moduleRoutes.map((route) => route.importStatement));

  if (isFastify(c)) {
    const registers = moduleRoutes
      .map((route) => `  await app.register(${route.routerIdentifier}, { prefix: '${route.mountPath}' });`)
      .join('\n');
    writeSrc(
      ctx,
      file,
      `${typeImport(c, `import type { FastifyInstance } from 'fastify';\n`)}${imports.join('\n')}${imports.length ? '\n\n' : ''}export async function v1Router(app${t(c, ': FastifyInstance')}) {
${registers || '  return app;'}
}
`,
    );
    return;
  }

  const mounts = moduleRoutes
    .map((route) => `v1Router.use('${route.mountPath}', ${route.routerIdentifier});`)
    .join('\n');
  writeSrc(
    ctx,
    file,
    `import { Router } from 'express';
${imports.join('\n')}${imports.length ? '\n\n' : ''}export const v1Router = Router();
${mounts}
`,
  );
}

function assembleApp(ctx: GenerationContextLike): void {
  writeSrc(ctx, appFilePath(ctx), renderApp(ctx, ctx.middlewares, ctx.routes));
}

function renderApp(
  ctx: GenerationContextLike,
  middlewares: MiddlewareRegistration[],
  routes: RouteRegistration[],
): string {
  const c = ctx.config;
  const orderedMw = sortByOrder(middlewares);
  const early = orderedMw.filter((item) => item.order < 900);
  const late = orderedMw.filter((item) => item.order >= 900);
  const appRoutes = sortByOrder(routes.filter(isAppLevelRoute));
  const imports = uniqueImports([
    ...early.map((item) => item.importStatement),
    ...appRoutes.map((item) => item.importStatement),
    ...late.map((item) => item.importStatement),
  ]);

  if (isFastify(c)) {
    const setup = [
      ...early.map((item) => `  ${item.useStatement}`),
      ...appRoutes.map((item) =>
        item.name === 'v1'
          ? `  await app.register(${item.routerIdentifier}, { prefix: '${item.mountPath}' });`
          : item.name === 'graphql'
            ? `  await app.register(${item.routerIdentifier}, { prefix: '${item.mountPath}' });`
            : `  await app.register(${item.routerIdentifier}${item.mountPath !== '/' ? `, { prefix: '${item.mountPath}' }` : ''});`,
      ),
      ...late.map((item) => `  ${item.useStatement}`),
    ].join('\n');

    let graphqlBoot = '';
    if (hasGraphql(c) && graphqlServer(c) === 'apollo') {
      const p = ctxPaths(ctx);
      const gqlFile = p.apiSrc(`graphql/${fileName(c, 'server')}`);
      imports.unshift(`import { createGraphqlServer } from '${relImport(appFilePath(ctx), gqlFile)}';`);
      graphqlBoot = `
  const graphql = await createGraphqlServer();
  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/graphql')) return;
    await graphql.executeHTTPGraphQLRequest({
      httpGraphQLRequest: {
        method: request.method,
        headers: request.headers,
        search: new URL(request.url, 'http://localhost').search,
        body: request.body,
      },
      context: async () => ({ requestId: request.requestId }),
    }).then((result) => {
      for (const [key, value] of result.headers) reply.header(key, value);
      reply.status(result.status ?? 200).send(result.body.kind === 'complete' ? JSON.parse(result.body.string) : result.body);
    });
  });
`;
    }

    return `import Fastify from 'fastify';
import { appConfig } from '${relImport(appFilePath(ctx), ctxPaths(ctx).apiFile('config', 'app'))}';
import { logger } from '${relImport(appFilePath(ctx), ctxPaths(ctx).apiFile('lib', 'logger'))}';
${imports.join('\n')}

export async function createApp() {
  const app = Fastify({
    loggerInstance: logger,
    bodyLimit: 1024 * 1024,
    genReqId: () => crypto.randomUUID(),
  });
${setup}${graphqlBoot}
  return app;
}
`;
  }

  const usesExpressJson = early.some((item) => item.name === 'json-parser' || item.name === 'urlencoded');
  const setup = [
    ...early.map((item) => `  ${item.useStatement}`),
    ...appRoutes.map((item) => `  app.use('${item.mountPath}', ${item.routerIdentifier});`),
    ...late.map((item) => `  ${item.useStatement}`),
  ]
    .filter(Boolean)
    .join('\n');

  if (hasGraphql(c) && graphqlServer(c) === 'apollo') {
    const p = ctxPaths(ctx);
    const gqlFile = p.apiSrc(`graphql/${fileName(c, 'server')}`);
    const extraImports = [
      `import { expressMiddleware } from '@as-integrations/express4';`,
      `import { createGraphqlServer } from '${relImport(appFilePath(ctx), gqlFile)}';`,
    ];
    const earlySetup = early.map((item) => `  ${item.useStatement}`).join('\n');
    const routeSetup = appRoutes
      .filter((item) => item.name !== 'graphql')
      .map((item) => `  app.use('${item.mountPath}', ${item.routerIdentifier});`)
      .join('\n');
    const lateSetup = late.map((item) => `  ${item.useStatement}`).join('\n');
    return `import express from 'express';
${[...extraImports, ...imports].join('\n')}

export async function createApp() {
  const app = express();
  app.set('trust proxy', 1);
${earlySetup}
${routeSetup}
  const graphql = await createGraphqlServer();
  app.use('/graphql', expressMiddleware(graphql, {
    context: async ({ req }) => ({ requestId: req.requestId, user: req.user }),
  }));
${lateSetup}
  return app;
}
`;
  }

  return `import express from 'express';
${imports.join('\n')}

export async function createApp() {
  const app = express();
  app.set('trust proxy', 1);
${setup}
  return app;
}
`;
  void usesExpressJson;
}

function uniqueImports(statements: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const block of statements) {
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

void generic;
void hasOAuth;
void hasSession;
