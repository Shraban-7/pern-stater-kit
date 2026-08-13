import { z } from 'zod';
import type { StarterConfig } from './types.js';

const architectureSchema = z.enum([
  'simple-mvc',
  'layered',
  'service-layer',
  'repository',
  'modular-monolith',
  'clean',
  'hexagonal',
  'ddd',
  'cqrs',
  'event-driven',
  'microservice-ready',
  'monorepo',
  'multi-tenant',
]);

const patternSchema = z.enum([
  'factory',
  'abstract-factory',
  'builder',
  'prototype',
  'singleton',
  'adapter',
  'bridge',
  'composite',
  'decorator',
  'facade',
  'proxy',
  'strategy',
  'command',
  'observer',
  'state',
  'chain-of-responsibility',
  'mediator',
  'template-method',
  'specification',
  'service-layer',
  'repository',
  'use-case',
  'dto',
  'mapper',
  'unit-of-work',
  'domain-event',
  'event-bus',
  'saga',
]);

export const starterConfigSchema: z.ZodType<StarterConfig> = z.object({
  version: z.literal(1),
  name: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z][a-zA-Z0-9-_]*$/, 'Project name must start with a letter and contain only letters, numbers, hyphens, and underscores'),
  language: z.enum(['typescript', 'javascript']),
  packageManager: z.enum(['npm', 'pnpm', 'yarn', 'bun']),
  nodeVersion: z.string().min(1),
  architecture: architectureSchema,
  architectures: z.array(architectureSchema),
  designPatterns: z.array(patternSchema),
  backend: z.object({
    framework: z.enum(['express', 'fastify']),
    api: z.enum(['rest', 'graphql', 'rest+graphql']),
    graphqlServer: z.enum(['apollo', 'yoga']).optional(),
  }),
  orm: z.enum(['prisma', 'drizzle', 'typeorm', 'sequelize', 'knex', 'pg']),
  database: z.literal('postgresql'),
  auth: z.enum(['none', 'jwt', 'session', 'jwt-refresh-token', 'oauth2']),
  passwordHash: z.enum(['argon2id', 'bcrypt']),
  oauthProviders: z.array(
    z.enum(['google', 'github', 'facebook', 'microsoft', 'apple', 'linkedin']),
  ),
  rbac: z.enum(['none', 'custom', 'casl', 'accesscontrol']),
  frontend: z.object({
    kind: z.enum(['vite-react', 'nextjs', 'none']),
    ui: z.enum(['tailwind', 'shadcn', 'mui', 'antd', 'chakra', 'headless', 'none']),
    state: z.enum(['none', 'zustand', 'redux', 'jotai']),
    serverState: z.enum(['none', 'tanstack-query', 'swr']),
    forms: z.enum(['none', 'react-hook-form', 'formik']),
    validation: z.enum(['zod', 'yup', 'valibot', 'joi']),
    apiClient: z.enum(['fetch', 'axios']),
    router: z.boolean(),
  }),
  cache: z.enum(['none', 'redis']),
  queue: z.enum(['none', 'bullmq']),
  storage: z.enum(['none', 'local', 's3', 'r2', 'minio']),
  email: z.enum(['none', 'smtp', 'resend', 'sendgrid', 'ses', 'mailgun', 'postmark']),
  notifications: z.array(z.enum(['email', 'database', 'push', 'sms', 'slack'])),
  payments: z.array(
    z.enum(['stripe', 'paypal', 'bkash', 'nagad', 'sslcommerz', 'razorpay']),
  ),
  websockets: z.enum(['none', 'socket.io', 'ws']),
  search: z.enum([
    'none',
    'postgres-fts',
    'meilisearch',
    'elasticsearch',
    'opensearch',
  ]),
  logging: z.enum(['pino', 'winston']),
  monitoring: z.array(z.enum(['sentry', 'opentelemetry', 'prometheus', 'health'])),
  testing: z.object({
    unit: z.enum(['vitest', 'jest']),
    e2e: z.enum(['playwright', 'cypress', 'none']),
  }),
  docker: z.enum(['none', 'dev', 'dev+prod']),
  cicd: z.enum(['none', 'github-actions', 'gitlab-ci']),
  deployment: z.array(z.string()),
  admin: z.enum(['none', 'custom', 'refine', 'react-admin']),
  multiTenancy: z.enum(['none', 'shared-db', 'db-per-tenant']),
  openapi: z.enum(['none', 'openapi', 'swagger', 'openapi+client']),
  validation: z.enum(['zod', 'yup', 'valibot', 'joi']),
  codeQuality: z.array(
    z.enum(['eslint', 'prettier', 'husky', 'lint-staged', 'commitlint', 'biome']),
  ),
  monorepo: z.enum(['none', 'npm', 'pnpm', 'turborepo', 'nx']),
  cqrs: z.enum(['none', 'basic', 'events']),
  events: z.enum(['none', 'in-process', 'redis-pubsub', 'queue']),
  pagination: z.enum(['offset', 'cursor', 'both']),
  auditLog: z.boolean(),
  mailpit: z.boolean(),
  features: z.array(z.string()),
});

export function parseStarterConfig(input: unknown): StarterConfig {
  return starterConfigSchema.parse(input);
}

export function safeParseStarterConfig(input: unknown) {
  return starterConfigSchema.safeParse(input);
}
