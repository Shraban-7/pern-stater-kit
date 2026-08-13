import type { PresetId, StarterConfig } from './types';

function normalize(input: StarterConfig): StarterConfig {
  const next = structuredClone(input);
  if (next.frontend.kind !== 'none') {
    next.frontend.kind = 'vite-react';
    next.frontend.router = true;
  }
  if (next.queue === 'bullmq' && next.cache !== 'redis') next.cache = 'redis';
  if (next.frontend.kind === 'none') next.monorepo = 'none';
  else if (next.monorepo === 'none') next.monorepo = 'turborepo';
  return next;
}

function baseConfig(name: string): StarterConfig {
  return {
    version: 1,
    name,
    language: 'typescript',
    packageManager: 'pnpm',
    nodeVersion: '20',
    architecture: 'modular-monolith',
    architectures: ['modular-monolith', 'monorepo'],
    designPatterns: ['service-layer', 'repository', 'dto'],
    backend: {
      framework: 'express',
      api: 'rest',
    },
    orm: 'prisma',
    database: 'postgresql',
    auth: 'jwt-refresh-token',
    passwordHash: 'argon2id',
    oauthProviders: [],
    rbac: 'custom',
    frontend: {
      kind: 'vite-react',
      ui: 'shadcn',
      state: 'zustand',
      serverState: 'tanstack-query',
      forms: 'react-hook-form',
      validation: 'zod',
      apiClient: 'axios',
      router: true,
    },
    cache: 'none',
    queue: 'none',
    storage: 'none',
    email: 'none',
    notifications: [],
    payments: [],
    websockets: 'none',
    search: 'none',
    logging: 'pino',
    monitoring: ['health'],
    testing: {
      unit: 'vitest',
      e2e: 'playwright',
    },
    docker: 'none',
    cicd: 'none',
    deployment: [],
    admin: 'none',
    multiTenancy: 'none',
    openapi: 'openapi',
    validation: 'zod',
    codeQuality: ['eslint', 'prettier'],
    monorepo: 'turborepo',
    cqrs: 'none',
    events: 'none',
    pagination: 'both',
    auditLog: false,
    mailpit: false,
    features: [],
  };
}

export function clientDefaultConfig(name = 'my-app'): StarterConfig {
  return normalize(baseConfig(name));
}

export function clientPresetConfig(name: string, preset: PresetId): StarterConfig {
  const next = structuredClone(baseConfig(name));
  switch (preset) {
    case 'basic':
      next.architecture = 'layered';
      next.architectures = ['layered', 'monorepo'];
      next.auth = 'none';
      next.rbac = 'none';
      next.frontend.ui = 'tailwind';
      next.openapi = 'none';
      next.monitoring = ['health'];
      break;
    case 'api':
      next.frontend.kind = 'none';
      next.auth = 'jwt-refresh-token';
      next.rbac = 'custom';
      next.cache = 'redis';
      next.queue = 'bullmq';
      next.docker = 'dev';
      next.openapi = 'swagger';
      next.monorepo = 'none';
      next.architectures = ['modular-monolith'];
      next.testing.e2e = 'none';
      break;
    case 'saas':
      next.cache = 'redis';
      next.queue = 'bullmq';
      next.payments = ['stripe'];
      next.storage = 's3';
      next.email = 'resend';
      next.monitoring = ['health', 'sentry'];
      next.docker = 'dev+prod';
      next.cicd = 'github-actions';
      next.multiTenancy = 'shared-db';
      next.mailpit = true;
      next.auditLog = true;
      next.designPatterns = ['service-layer', 'repository', 'dto', 'adapter', 'strategy', 'factory'];
      break;
    case 'ecommerce':
      next.cache = 'redis';
      next.queue = 'bullmq';
      next.payments = ['stripe', 'bkash', 'nagad'];
      next.storage = 'r2';
      next.search = 'postgres-fts';
      next.notifications = ['email', 'database'];
      next.email = 'resend';
      next.docker = 'dev+prod';
      next.auditLog = true;
      next.mailpit = true;
      next.designPatterns = ['service-layer', 'repository', 'dto', 'adapter', 'strategy', 'factory'];
      break;
    case 'enterprise':
      next.architecture = 'ddd';
      next.architectures = ['ddd', 'clean', 'monorepo'];
      next.auth = 'oauth2';
      next.oauthProviders = ['google', 'github'];
      next.rbac = 'custom';
      next.cache = 'redis';
      next.queue = 'bullmq';
      next.openapi = 'openapi+client';
      next.monitoring = ['health', 'sentry', 'opentelemetry'];
      next.docker = 'dev+prod';
      next.cicd = 'github-actions';
      next.cqrs = 'basic';
      next.events = 'in-process';
      next.auditLog = true;
      next.designPatterns = [
        'service-layer',
        'repository',
        'use-case',
        'dto',
        'adapter',
        'specification',
        'domain-event',
        'event-bus',
      ];
      break;
    default:
      break;
  }
  return normalize(next);
}
