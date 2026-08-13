export const STARTER_VERSION = 1 as const;

export type Language = 'typescript' | 'javascript';
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';
export type BackendFramework = 'express' | 'fastify';
export type ApiStyle = 'rest' | 'graphql' | 'rest+graphql';
export type GraphqlServer = 'apollo' | 'yoga';
export type Orm = 'prisma' | 'drizzle' | 'typeorm' | 'sequelize' | 'knex' | 'pg';
export type AuthStrategy = 'none' | 'jwt' | 'session' | 'jwt-refresh-token' | 'oauth2';
export type PasswordHash = 'argon2id' | 'bcrypt';
export type OAuthProviderId =
  | 'google'
  | 'github'
  | 'facebook'
  | 'microsoft'
  | 'apple'
  | 'linkedin';
export type RbacStrategy = 'none' | 'custom' | 'casl' | 'accesscontrol';
export type FrontendKind = 'vite-react' | 'nextjs' | 'none';
export type UiFramework =
  | 'tailwind'
  | 'shadcn'
  | 'mui'
  | 'antd'
  | 'chakra'
  | 'headless'
  | 'none';
export type StateLibrary = 'none' | 'zustand' | 'redux' | 'jotai';
export type ServerState = 'none' | 'tanstack-query' | 'swr';
export type FormLibrary = 'none' | 'react-hook-form' | 'formik';
export type ValidationLib = 'zod' | 'yup' | 'valibot' | 'joi';
export type ApiClient = 'fetch' | 'axios';
export type CacheProvider = 'none' | 'redis';
export type QueueProvider = 'none' | 'bullmq';
export type StorageProviderId = 'none' | 'local' | 's3' | 'r2' | 'minio';
export type EmailProviderId =
  | 'none'
  | 'smtp'
  | 'resend'
  | 'sendgrid'
  | 'ses'
  | 'mailgun'
  | 'postmark';
export type NotificationChannel = 'email' | 'database' | 'push' | 'sms' | 'slack';
export type PaymentProviderId =
  | 'stripe'
  | 'paypal'
  | 'bkash'
  | 'nagad'
  | 'sslcommerz'
  | 'razorpay';
export type WebsocketProvider = 'none' | 'socket.io' | 'ws';
export type SearchProviderId =
  | 'none'
  | 'postgres-fts'
  | 'meilisearch'
  | 'elasticsearch'
  | 'opensearch';
export type LoggingLib = 'pino' | 'winston';
export type MonitoringOption = 'sentry' | 'opentelemetry' | 'prometheus' | 'health';
export type UnitTestRunner = 'vitest' | 'jest';
export type E2ERunner = 'playwright' | 'cypress' | 'none';
export type DockerMode = 'none' | 'dev' | 'dev+prod';
export type CicdProvider = 'none' | 'github-actions' | 'gitlab-ci';
export type AdminDashboard = 'none' | 'custom' | 'refine' | 'react-admin';
export type MultiTenancy = 'none' | 'shared-db' | 'db-per-tenant';
export type OpenApiMode = 'none' | 'openapi' | 'swagger' | 'openapi+client';
export type CqrsMode = 'none' | 'basic' | 'events';
export type MonorepoTool = 'none' | 'npm' | 'pnpm' | 'turborepo' | 'nx';
export type CodeQualityTool =
  | 'eslint'
  | 'prettier'
  | 'husky'
  | 'lint-staged'
  | 'commitlint'
  | 'biome';
export type PaginationMode = 'offset' | 'cursor' | 'both';
export type EventBus = 'none' | 'in-process' | 'redis-pubsub' | 'queue';

export type ArchitectureId =
  | 'simple-mvc'
  | 'layered'
  | 'service-layer'
  | 'repository'
  | 'modular-monolith'
  | 'clean'
  | 'hexagonal'
  | 'ddd'
  | 'cqrs'
  | 'event-driven'
  | 'microservice-ready'
  | 'monorepo'
  | 'multi-tenant';

export type PatternId =
  | 'factory'
  | 'abstract-factory'
  | 'builder'
  | 'prototype'
  | 'singleton'
  | 'adapter'
  | 'bridge'
  | 'composite'
  | 'decorator'
  | 'facade'
  | 'proxy'
  | 'strategy'
  | 'command'
  | 'observer'
  | 'state'
  | 'chain-of-responsibility'
  | 'mediator'
  | 'template-method'
  | 'specification'
  | 'service-layer'
  | 'repository'
  | 'use-case'
  | 'dto'
  | 'mapper'
  | 'unit-of-work'
  | 'domain-event'
  | 'event-bus'
  | 'saga';

export type PresetId = 'basic' | 'api' | 'saas' | 'ecommerce' | 'enterprise';

export interface StarterConfig {
  version: typeof STARTER_VERSION;
  name: string;
  language: Language;
  packageManager: PackageManager;
  nodeVersion: string;
  architecture: ArchitectureId;
  architectures: ArchitectureId[];
  designPatterns: PatternId[];
  backend: {
    framework: BackendFramework;
    api: ApiStyle;
    graphqlServer?: GraphqlServer;
  };
  orm: Orm;
  database: 'postgresql';
  auth: AuthStrategy;
  passwordHash: PasswordHash;
  oauthProviders: OAuthProviderId[];
  rbac: RbacStrategy;
  frontend: {
    kind: FrontendKind;
    ui: UiFramework;
    state: StateLibrary;
    serverState: ServerState;
    forms: FormLibrary;
    validation: ValidationLib;
    apiClient: ApiClient;
    router: boolean;
  };
  cache: CacheProvider;
  queue: QueueProvider;
  storage: StorageProviderId;
  email: EmailProviderId;
  notifications: NotificationChannel[];
  payments: PaymentProviderId[];
  websockets: WebsocketProvider;
  search: SearchProviderId;
  logging: LoggingLib;
  monitoring: MonitoringOption[];
  testing: {
    unit: UnitTestRunner;
    e2e: E2ERunner;
  };
  docker: DockerMode;
  cicd: CicdProvider;
  deployment: string[];
  admin: AdminDashboard;
  multiTenancy: MultiTenancy;
  openapi: OpenApiMode;
  validation: ValidationLib;
  codeQuality: CodeQualityTool[];
  monorepo: MonorepoTool;
  cqrs: CqrsMode;
  events: EventBus;
  pagination: PaginationMode;
  auditLog: boolean;
  mailpit: boolean;
  features: string[];
}

export interface PackageDefinition {
  name: string;
  version: string;
  dev?: boolean;
  workspace: 'root' | 'api' | 'web' | 'admin' | string;
}

export interface EnvDefinition {
  key: string;
  example: string;
  required: boolean;
  description: string;
  workspace?: 'api' | 'web' | 'root';
  secret?: boolean;
}

export interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  dependencies: string[];
  conflicts: string[];
  packages: PackageDefinition[];
  env: EnvDefinition[];
  dockerServices: string[];
  installer: string;
  generator?: string;
  optional?: boolean;
}

export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
  fix?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface FeatureInstaller {
  id(): string;
  supports(config: StarterConfig): boolean;
  validate(config: StarterConfig): ValidationResult;
  install(context: GenerationContextLike): Promise<void>;
  remove(context: GenerationContextLike): Promise<void>;
}

export interface Generator {
  id(): string;
  supports(config: StarterConfig): boolean;
  validate(config: StarterConfig): ValidationResult;
  generate(context: GenerationContextLike): Promise<void>;
}

export interface PlannedFile {
  path: string;
  contents: string;
  action: 'create' | 'modify';
}

export interface PlannedPackage {
  name: string;
  version: string;
  dev?: boolean;
  workspace: string;
}

export interface GenerationPlan {
  projectName: string;
  destination: string;
  files: PlannedFile[];
  packages: PlannedPackage[];
  env: EnvDefinition[];
  dockerServices: string[];
  scripts: Record<string, string>;
  features: string[];
  warnings: ValidationIssue[];
  notes: string[];
}

export interface GenerationContextLike {
  config: StarterConfig;
  destination: string;
  dryRun: boolean;
  files: Map<string, string>;
  packages: PlannedPackage[];
  env: EnvDefinition[];
  dockerServices: Set<string>;
  scripts: Record<string, string>;
  notes: string[];
  warnings: ValidationIssue[];
  middlewares: MiddlewareRegistration[];
  routes: RouteRegistration[];
  prismaModels: string[];
  prismaEnums: string[];
  writeFile(relativePath: string, contents: string): void;
  addPackage(pkg: PlannedPackage): void;
  addEnv(env: EnvDefinition): void;
  addDockerService(name: string): void;
  addScript(name: string, command: string): void;
  addMiddleware(registration: MiddlewareRegistration): void;
  addRoute(registration: RouteRegistration): void;
  addPrismaModel(source: string): void;
  addPrismaEnum(source: string): void;
  addNote(note: string): void;
  warn(issue: ValidationIssue): void;
}

export interface MiddlewareRegistration {
  name: string;
  importStatement: string;
  useStatement: string;
  order: number;
}

export interface RouteRegistration {
  name: string;
  importStatement: string;
  mountPath: string;
  routerIdentifier: string;
  order: number;
}

export interface ArchitectureDefinition {
  id: ArchitectureId;
  name: string;
  description: string;
  compatibleWith: ArchitectureId[];
  conflicts: ArchitectureId[];
}

export interface PatternDefinition {
  id: PatternId;
  name: string;
  category: 'creational' | 'structural' | 'behavioral' | 'application';
  description: string;
  warn?: string;
}

export interface PatternRecommendation {
  pattern: PatternId;
  reason: string;
}

export type OverwriteChoice = 'skip' | 'replace' | 'merge' | 'cancel';

export interface Manifest {
  version: typeof STARTER_VERSION;
  stack: 'PERN';
  generatedAt: string;
  generatorVersion: string;
  config: StarterConfig;
}

export interface CliOptions {
  preset?: PresetId;
  config?: string;
  dryRun?: boolean;
  yes?: boolean;
  force?: boolean;
  install?: boolean;
  orm?: Orm;
  auth?: AuthStrategy;
  frontend?: FrontendKind;
  architecture?: ArchitectureId;
  rbac?: RbacStrategy;
  docker?: boolean;
  redis?: boolean;
  language?: Language;
  packageManager?: PackageManager;
  nodeVersion?: string;
}

export const emptyValidation = (): ValidationResult => ({
  ok: true,
  errors: [],
  warnings: [],
});

export const failValidation = (errors: ValidationIssue[]): ValidationResult => ({
  ok: false,
  errors,
  warnings: [],
});
