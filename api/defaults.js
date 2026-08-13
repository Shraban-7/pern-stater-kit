const config = {
  version: 1,
  name: 'my-app',
  language: 'typescript',
  packageManager: 'pnpm',
  nodeVersion: '20',
  architecture: 'modular-monolith',
  architectures: ['modular-monolith', 'monorepo'],
  designPatterns: ['service-layer', 'repository', 'dto'],
  backend: { framework: 'express', api: 'rest' },
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
  testing: { unit: 'vitest', e2e: 'playwright' },
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

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  res.status(200).json({ config });
}
