import path from 'node:path';
import type {
  ArchitectureId,
  GenerationContextLike,
  StarterConfig,
} from '../../core/types.js';
import { pathsFor } from '../../core/paths.js';
import { isTs, t, typeImport } from '../helpers.js';

export { isTs, t, typeImport };

export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_DAYS = 7;
export const AUTH_RATE_MAX = 5;
export const GENERAL_RATE_MAX = 100;
export const SENSITIVE_RATE_MAX = 10;
export const LOCKOUT_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
export const JSON_BODY_LIMIT = '1mb';
export const DEV_ADMIN_EMAIL = 'admin@localhost';
export const DEV_ADMIN_PASSWORD = 'change-me';

export function primaryArchitecture(config: StarterConfig): ArchitectureId {
  if (
    config.architecture === 'monorepo' ||
    config.architecture === 'microservice-ready' ||
    config.architecture === 'multi-tenant'
  ) {
    return (
      config.architectures.find(
        (item) => !['monorepo', 'microservice-ready', 'multi-tenant'].includes(item),
      ) ?? 'modular-monolith'
    );
  }
  return config.architecture;
}

export function usesFeatureModules(config: StarterConfig): boolean {
  return ['modular-monolith', 'clean', 'hexagonal', 'ddd'].includes(
    primaryArchitecture(config),
  );
}

export function usesRepositories(config: StarterConfig): boolean {
  return (
    config.designPatterns.includes('repository') ||
    ['repository', 'modular-monolith', 'clean', 'hexagonal', 'ddd'].includes(
      primaryArchitecture(config),
    )
  );
}

export function usesUseCases(config: StarterConfig): boolean {
  return (
    config.designPatterns.includes('use-case') ||
    ['clean', 'hexagonal', 'ddd'].includes(primaryArchitecture(config))
  );
}

export function apiMod(config: StarterConfig, name: string): string | undefined {
  return usesFeatureModules(config) ? name : undefined;
}

export function isExpress(config: StarterConfig): boolean {
  return config.backend.framework !== 'fastify';
}

export function isFastify(config: StarterConfig): boolean {
  return config.backend.framework === 'fastify';
}

export function hasAuth(config: StarterConfig): boolean {
  return config.auth !== 'none';
}

export function hasJwt(config: StarterConfig): boolean {
  return config.auth === 'jwt' || config.auth === 'jwt-refresh-token' || config.auth === 'oauth2';
}

export function hasRefresh(config: StarterConfig): boolean {
  return config.auth === 'jwt-refresh-token';
}

export function hasSession(config: StarterConfig): boolean {
  return config.auth === 'session';
}

export function hasOAuth(config: StarterConfig): boolean {
  return config.auth === 'oauth2' || config.oauthProviders.length > 0;
}

export function hasGraphql(config: StarterConfig): boolean {
  return config.backend.api === 'graphql' || config.backend.api === 'rest+graphql';
}

export function hasRest(config: StarterConfig): boolean {
  return config.backend.api !== 'graphql';
}

export function hasHealth(config: StarterConfig): boolean {
  return config.monitoring.includes('health') || config.monitoring.length === 0;
}

export function hasOpenApi(config: StarterConfig): boolean {
  return config.openapi !== 'none';
}

export function hasSwaggerUi(config: StarterConfig): boolean {
  return config.openapi === 'swagger' || config.openapi === 'openapi+client';
}

export function graphqlServer(config: StarterConfig): 'apollo' | 'yoga' {
  return config.backend.graphqlServer ?? 'apollo';
}

export function prismaDir(ctx: GenerationContextLike): string {
  const root = pathsFor(ctx.config).apiRoot;
  return root === '.' ? 'prisma' : `${root}/prisma`;
}

export function apiPkgName(ctx: GenerationContextLike): string {
  const root = pathsFor(ctx.config).apiRoot;
  return root === '.' ? ctx.config.name : 'api';
}

export function apiPackageJsonPath(ctx: GenerationContextLike): string {
  const root = pathsFor(ctx.config).apiRoot;
  return root === '.' ? 'package.json' : `${root}/package.json`;
}

export function relImport(fromFile: string, toFile: string): string {
  const fromDir = path.posix.dirname(fromFile.replaceAll('\\', '/'));
  const to = toFile.replaceAll('\\', '/').replace(/\.(tsx?|jsx?)$/, '');
  let rel = path.posix.relative(fromDir, to);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return `${rel}.js`;
}

export function relAsset(fromFile: string, toFile: string): string {
  const fromDir = path.posix.dirname(fromFile.replaceAll('\\', '/'));
  let rel = path.posix.relative(fromDir, toFile.replaceAll('\\', '/'));
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

export function params(config: StarterConfig, items: Array<[string, string]>): string {
  return items.map(([name, type]) => (isTs(config) ? `${name}: ${type}` : name)).join(', ');
}

export function ret(config: StarterConfig, type: string): string {
  return isTs(config) ? `: ${type}` : '';
}

export function generic(config: StarterConfig, type: string): string {
  return isTs(config) ? `<${type}>` : '';
}

export function asType(config: StarterConfig, type: string): string {
  return isTs(config) ? ` as ${type}` : '';
}

export function opt(config: StarterConfig, type: string): string {
  return isTs(config) ? type : '';
}

export function httpTypes(config: StarterConfig): { req: string; res: string; next: string; importLine: string } {
  if (isFastify(config)) {
    return {
      req: 'FastifyRequest',
      res: 'FastifyReply',
      next: '() => void',
      importLine: typeImport(config, `import type { FastifyRequest, FastifyReply } from 'fastify';`),
    };
  }
  return {
    req: 'Request',
    res: 'Response',
    next: 'NextFunction',
    importLine: typeImport(
      config,
      `import type { NextFunction, Request, Response } from 'express';`,
    ),
  };
}

export function promiseOf(config: StarterConfig, inner: string): string {
  return isTs(config) ? `: Promise<${inner}>` : '';
}

export function interfaceBlock(config: StarterConfig, source: string): string {
  return isTs(config) ? `${source}\n` : '';
}

export function exportType(config: StarterConfig, name: string, body: string): string {
  if (!isTs(config)) return '';
  return `export type ${name} = ${body};\n`;
}

export function exportInterface(config: StarterConfig, name: string, body: string): string {
  if (!isTs(config)) return '';
  return `export interface ${name} ${body}\n`;
}

export function maybeAsyncHandler(config: StarterConfig, handlerExpr: string): string {
  if (isFastify(config)) return handlerExpr;
  return `asyncHandler(${handlerExpr})`;
}

export function buildPrismaSchema(ctx: GenerationContextLike): string {
  const header = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`;
  const enums = ctx.prismaEnums.filter(Boolean);
  const models = ctx.prismaModels.filter(Boolean);
  return [header, ...enums, ...models].filter(Boolean).join('\n\n') + '\n';
}

export function validationLib(config: StarterConfig): StarterConfig['validation'] {
  return config.validation;
}

export function envSchemaExpr(
  config: StarterConfig,
  fields: Array<{ key: string; zod: string; yup: string; joi: string; valibot: string }>,
): string {
  const lib = validationLib(config);
  if (lib === 'yup') {
    const inner = fields.map((f) => `  ${f.key}: ${f.yup},`).join('\n');
    return `yup.object({\n${inner}\n})`;
  }
  if (lib === 'joi') {
    const inner = fields.map((f) => `  ${f.key}: ${f.joi},`).join('\n');
    return `Joi.object({\n${inner}\n})`;
  }
  if (lib === 'valibot') {
    const inner = fields.map((f) => `  ${f.key}: ${f.valibot},`).join('\n');
    return `v.object({\n${inner}\n})`;
  }
  const inner = fields.map((f) => `  ${f.key}: ${f.zod},`).join('\n');
  return `z.object({\n${inner}\n})`;
}

export function validationImport(config: StarterConfig): string {
  const lib = validationLib(config);
  if (lib === 'yup') return `import * as yup from 'yup';\n`;
  if (lib === 'joi') return `import Joi from 'joi';\n`;
  if (lib === 'valibot') return `import * as v from 'valibot';\n`;
  return `import { z } from 'zod';\n`;
}

export function parseEnvCall(config: StarterConfig): string {
  const lib = validationLib(config);
  if (lib === 'yup') return 'envSchema.validateSync(process.env, { abortEarly: false, stripUnknown: true })';
  if (lib === 'joi') {
    return `(function parseJoiEnv() {
  const result = envSchema.unknown(true).validate(process.env, { abortEarly: false, stripUnknown: true });
  if (result.error) throw result.error;
  return result.value;
})()`;
  }
  if (lib === 'valibot') return 'v.parse(envSchema, process.env)';
  return 'envSchema.parse(process.env)';
}

export function ensureNl(contents: string): string {
  return contents.endsWith('\n') ? contents : `${contents}\n`;
}

export function writeSrc(ctx: GenerationContextLike, relativePath: string, contents: string): void {
  ctx.writeFile(relativePath, ensureNl(contents));
}

export function jsonBodyLimitMiddleware(config: StarterConfig): string {
  if (isFastify(config)) {
    return '';
  }
  return `express.json({ limit: '${JSON_BODY_LIMIT}' })`;
}

export function cookieNames() {
  return {
    access: 'access_token',
    refresh: 'refresh_token',
  };
}

export function oauthCallbackUrl(provider: string): string {
  return `/api/v1/auth/oauth/${provider}/callback`;
}

export function needsJwtSecret(config: StarterConfig): boolean {
  return hasJwt(config) || hasOAuth(config);
}

export function needsRedis(config: StarterConfig): boolean {
  return config.cache === 'redis' || config.queue === 'bullmq' || config.events === 'redis-pubsub';
}

export function dbClientIdent(config: StarterConfig): string {
  switch (config.orm) {
    case 'prisma':
      return 'prisma';
    case 'drizzle':
      return 'db';
    case 'typeorm':
      return 'dataSource';
    case 'sequelize':
      return 'sequelize';
    case 'knex':
      return 'knex';
    case 'pg':
      return 'pool';
    default:
      return 'db';
  }
}
