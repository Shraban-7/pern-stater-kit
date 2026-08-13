export type FrontendKind = 'vite-react' | 'none';

export type StarterConfig = {
  version: 1;
  name: string;
  language: 'typescript' | 'javascript';
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  nodeVersion: string;
  architecture: string;
  architectures: string[];
  designPatterns: string[];
  backend: {
    framework: 'express' | 'fastify';
    api: 'rest' | 'graphql' | 'rest+graphql';
    graphqlServer?: 'apollo' | 'yoga';
  };
  orm: string;
  database: 'postgresql';
  auth: string;
  passwordHash: 'argon2id' | 'bcrypt';
  oauthProviders: string[];
  rbac: string;
  frontend: {
    kind: FrontendKind;
    ui: string;
    state: string;
    serverState: string;
    forms: string;
    validation: string;
    apiClient: 'fetch' | 'axios';
    router: boolean;
  };
  cache: 'none' | 'redis';
  queue: 'none' | 'bullmq';
  storage: string;
  email: string;
  notifications: string[];
  payments: string[];
  websockets: string;
  search: string;
  logging: 'pino' | 'winston';
  monitoring: string[];
  testing: { unit: 'vitest' | 'jest'; e2e: 'playwright' | 'cypress' | 'none' };
  docker: 'none' | 'dev' | 'dev+prod';
  cicd: string;
  deployment: string[];
  admin: string;
  multiTenancy: string;
  openapi: string;
  validation: string;
  codeQuality: string[];
  monorepo: string;
  cqrs: string;
  events: string;
  pagination: string;
  auditLog: boolean;
  mailpit: boolean;
  features: string[];
};

export type Plan = {
  files: string[];
  packages: Array<{ name: string; version: string; workspace: string; dev?: boolean }>;
  env: string[];
  dockerServices: string[];
  features: string[];
  next?: string[];
  warnings?: Array<{ message: string }>;
};

export type Bundle = Plan & {
  project: string;
  contents: Array<{ path: string; contents: string }>;
};

export const PRESETS = ['basic', 'api', 'saas', 'ecommerce', 'enterprise'] as const;
export type PresetId = (typeof PRESETS)[number];
