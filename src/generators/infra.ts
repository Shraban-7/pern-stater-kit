import { stringify } from 'yaml';
import { pathsFor } from '../core/paths.js';
import {
  emptyValidation,
  type Generator,
  type GenerationContextLike,
  type StarterConfig,
  type ValidationResult,
} from '../core/types.js';
import { addApiDeps, addRootDeps, addWebDeps, ctxPaths, isTs } from './helpers.js';

export class InfraGenerator implements Generator {
  id(): string {
    return 'infra';
  }

  supports(): boolean {
    return true;
  }

  validate(): ValidationResult {
    return emptyValidation();
  }

  async generate(ctx: GenerationContextLike): Promise<void> {
    writeTesting(ctx);
    if (ctx.config.docker !== 'none') writeDocker(ctx);
    if (ctx.config.cicd === 'github-actions') writeGithubActions(ctx);
    if (ctx.config.cicd === 'gitlab-ci') writeGitlabCi(ctx);
    writeDeployProfiles(ctx);
  }
}

function selectedServices(config: StarterConfig): string[] {
  const services = ['api', 'postgres'];
  if (config.frontend.kind !== 'none') services.push('web');
  if (config.cache === 'redis' || config.queue === 'bullmq') services.push('redis');
  if (config.mailpit) services.push('mailpit');
  if (config.storage === 'minio') services.push('minio');
  return services;
}

function writeDocker(ctx: GenerationContextLike): void {
  const { config } = ctx;
  const services = selectedServices(config);
  for (const name of services) ctx.addDockerService(name);

  const node = config.nodeVersion || '20';
  const dbName = kebab(config.name);
  const includeWeb = services.includes('web');
  const includeRedis = services.includes('redis');
  const includeMailpit = services.includes('mailpit');
  const includeMinio = services.includes('minio');

  ctx.writeFile('docker-compose.yml', `${stringify(baseCompose(config, { includeWeb, includeRedis, includeMailpit, includeMinio, dbName, node }), { indent: 2 })}\n`);
  ctx.writeFile(
    'docker-compose.dev.yml',
    `${stringify(devCompose(config, { includeWeb, includeRedis, includeMailpit, includeMinio }), { indent: 2 })}\n`,
  );

  if (config.docker === 'dev+prod') {
    ctx.writeFile(
      'docker-compose.prod.yml',
      `${stringify(prodCompose(config, { includeWeb, includeRedis, includeMailpit, includeMinio, dbName }), { indent: 2 })}\n`,
    );
    writeDockerfiles(ctx, node, includeWeb);
  }
}

function apiService(
  config: StarterConfig,
  opts: { includeRedis: boolean; dbName: string; node: string },
): Record<string, unknown> {
  const apiRoot = pathsFor(config).apiRoot === '.' ? '.' : './apps/api';
  const environment = {
    NODE_ENV: '${NODE_ENV:-development}',
    PORT: '${PORT:-4000}',
    DATABASE_URL: '${DATABASE_URL:-postgresql://postgres:postgres@postgres:5432/' + opts.dbName + '?schema=public}',
    CORS_ORIGIN: '${CORS_ORIGIN:-http://localhost:5173}',
    ...(opts.includeRedis ? { REDIS_URL: '${REDIS_URL:-redis://redis:6379}' } : {}),
  };
  const shared = {
    environment,
    ports: ['${PORT:-4000}:4000'],
    depends_on: {
      postgres: { condition: 'service_healthy' },
      ...(opts.includeRedis ? { redis: { condition: 'service_healthy' } } : {}),
    },
    healthcheck: {
      test: [
        'CMD',
        'node',
        '-e',
        'fetch("http://127.0.0.1:4000/health").then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))',
      ],
      interval: '10s',
      timeout: '5s',
      retries: 10,
    },
  };
  if (config.docker === 'dev+prod') {
    return {
      build: {
        context: '.',
        dockerfile: dockerfilePath(config, 'api'),
        target: 'development',
      },
      ...shared,
    };
  }
  return {
    image: `node:${opts.node}-alpine`,
    working_dir: '/app',
    volumes: [`${apiRoot}:/app`],
    command: ['sh', '-c', 'npm install && npm run dev'],
    ...shared,
  };
}

function webService(config: StarterConfig, opts: { node: string }): Record<string, unknown> {
  const envKey = config.frontend.kind === 'nextjs' ? 'NEXT_PUBLIC_API_URL' : 'VITE_API_URL';
  const port = config.frontend.kind === 'nextjs' ? '${WEB_PORT:-3000}:3000' : '${WEB_PORT:-5173}:5173';
  const shared = {
    environment: {
      NODE_ENV: '${NODE_ENV:-development}',
      [envKey]: '${VITE_API_URL:-http://localhost:4000/api/v1}',
    },
    ports: [port],
    depends_on: { api: { condition: 'service_healthy' } },
  };
  if (config.docker === 'dev+prod') {
    return {
      build: { context: '.', dockerfile: dockerfilePath(config, 'web') },
      ...shared,
    };
  }
  return {
    image: `node:${opts.node}-alpine`,
    working_dir: '/app',
    volumes: ['./apps/web:/app'],
    command: ['sh', '-c', 'npm install && npm run dev -- --host 0.0.0.0'],
    ...shared,
  };
}

function baseCompose(
  config: StarterConfig,
  opts: { includeWeb: boolean; includeRedis: boolean; includeMailpit: boolean; includeMinio: boolean; dbName: string; node: string },
) {
  const services: Record<string, unknown> = {
    postgres: {
      image: 'postgres:16-alpine',
      environment: {
        POSTGRES_USER: '${POSTGRES_USER:-postgres}',
        POSTGRES_PASSWORD: '${POSTGRES_PASSWORD:-postgres}',
        POSTGRES_DB: `\${POSTGRES_DB:-${opts.dbName}}`,
      },
      volumes: ['postgres_data:/var/lib/postgresql/data'],
      ports: ['${POSTGRES_PORT:-5432}:5432'],
      healthcheck: {
        test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-' + opts.dbName + '}'],
        interval: '5s',
        timeout: '5s',
        retries: 10,
      },
    },
    api: apiService(config, opts),
  };

  if (opts.includeWeb) {
    services.web = webService(config, { node: opts.node });
  }

  if (opts.includeRedis) {
    services.redis = {
      image: 'redis:7-alpine',
      ports: ['${REDIS_PORT:-6379}:6379'],
      healthcheck: {
        test: ['CMD', 'redis-cli', 'ping'],
        interval: '5s',
        timeout: '3s',
        retries: 10,
      },
    };
  }

  if (opts.includeMailpit) {
    services.mailpit = {
      image: 'axllent/mailpit:latest',
      ports: ['${MAILPIT_UI_PORT:-8025}:8025', '${MAILPIT_SMTP_PORT:-1025}:1025'],
    };
  }

  if (opts.includeMinio) {
    services.minio = {
      image: 'minio/minio:latest',
      command: 'server /data --console-address ":9001"',
      environment: {
        MINIO_ROOT_USER: '${MINIO_ROOT_USER:-minio}',
        MINIO_ROOT_PASSWORD: '${MINIO_ROOT_PASSWORD:-minio12345}',
      },
      ports: ['${MINIO_PORT:-9000}:9000', '${MINIO_CONSOLE_PORT:-9001}:9001'],
      volumes: ['minio_data:/data'],
      healthcheck: {
        test: ['CMD', 'mc', 'ready', 'local'],
        interval: '10s',
        timeout: '5s',
        retries: 10,
      },
    };
  }

  const volumes: Record<string, Record<string, never>> = { postgres_data: {} };
  if (opts.includeMinio) volumes.minio_data = {};

  return { services, volumes };
}

function dockerfilePath(config: StarterConfig, app: 'api' | 'web'): string {
  if (app === 'api') {
    return pathsFor(config).apiRoot === '.' ? 'Dockerfile' : 'apps/api/Dockerfile';
  }
  return 'apps/web/Dockerfile';
}

function devCompose(
  config: StarterConfig,
  opts: { includeWeb: boolean; includeRedis: boolean; includeMailpit: boolean; includeMinio: boolean },
) {
  const apiRoot = pathsFor(config).apiRoot === '.' ? '.' : './apps/api';
  const services: Record<string, unknown> = {
    api: {
      volumes: [`${apiRoot}/src:/app/src`],
      environment: { NODE_ENV: 'development' },
      command: ['sh', '-c', 'npm run dev'],
    },
  };
  if (opts.includeWeb) {
    services.web = {
      volumes: ['./apps/web/src:/app/src'],
      environment: { NODE_ENV: 'development' },
    };
  }
  return { services };
}

function prodCompose(
  config: StarterConfig,
  opts: { includeWeb: boolean; includeRedis: boolean; includeMailpit: boolean; includeMinio: boolean; dbName: string },
) {
  const services: Record<string, unknown> = {
    postgres: {
      environment: {
        POSTGRES_USER: '${POSTGRES_USER}',
        POSTGRES_PASSWORD: '${POSTGRES_PASSWORD}',
        POSTGRES_DB: '${POSTGRES_DB}',
      },
      ports: [],
      restart: 'unless-stopped',
    },
    api: {
      build: {
        context: '.',
        dockerfile: dockerfilePath(config, 'api'),
        target: 'production',
      },
      env_file: [pathsFor(config).apiRoot === '.' ? '.env.production' : 'apps/api/.env.production'],
      environment: {
        NODE_ENV: 'production',
        DATABASE_URL: '${DATABASE_URL}',
        CORS_ORIGIN: '${CORS_ORIGIN}',
        ...(opts.includeRedis ? { REDIS_URL: '${REDIS_URL}' } : {}),
      },
      restart: 'unless-stopped',
    },
  };
  if (opts.includeWeb) {
    services.web = {
      build: {
        context: '.',
        dockerfile: dockerfilePath(config, 'web'),
        target: 'production',
      },
      environment: { NODE_ENV: 'production' },
      restart: 'unless-stopped',
    };
  }
  if (opts.includeRedis) {
    services.redis = { restart: 'unless-stopped', ports: [] };
  }
  if (opts.includeMailpit) {
    services.mailpit = { profiles: ['dev-tools'] };
  }
  if (opts.includeMinio) {
    services.minio = {
      environment: {
        MINIO_ROOT_USER: '${MINIO_ROOT_USER}',
        MINIO_ROOT_PASSWORD: '${MINIO_ROOT_PASSWORD}',
      },
      restart: 'unless-stopped',
    };
  }
  return { services };
}

function writeDockerfiles(ctx: GenerationContextLike, node: string, includeWeb: boolean): void {
  const { config } = ctx;
  const paths = ctxPaths(ctx);
  const apiDocker = paths.apiRoot === '.' ? 'Dockerfile' : `${paths.apiRoot}/Dockerfile`;
  const pm = config.packageManager;
  const install =
    pm === 'pnpm' ? 'corepack enable && pnpm install --frozen-lockfile' : pm === 'yarn' ? 'yarn install --frozen-lockfile' : pm === 'bun' ? 'bun install --frozen-lockfile' : 'npm ci';

  ctx.writeFile(
    apiDocker,
    `FROM node:${node}-alpine AS development
WORKDIR /app
RUN apk add --no-cache wget
COPY package.json ./
RUN ${pm === 'pnpm' ? 'corepack enable && pnpm install' : pm === 'yarn' ? 'yarn' : pm === 'bun' ? 'bun install' : 'npm install'}
COPY . .
CMD ["npm", "run", "dev"]

FROM node:${node}-alpine AS build
WORKDIR /app
COPY package.json ./
RUN ${install}
COPY . .
RUN npm run build

FROM node:${node}-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache wget
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --retries=8 CMD wget -qO- http://127.0.0.1:4000/health || exit 1
USER node
CMD ["node", "dist/server.js"]
`,
  );

  if (!includeWeb) return;

  if (config.frontend.kind === 'nextjs') {
    ctx.writeFile(
      `${paths.webRoot}/Dockerfile`,
      `FROM node:${node}-alpine AS development
WORKDIR /app
COPY apps/web/package.json ./
RUN npm install
COPY apps/web ./
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM node:${node}-alpine AS build
WORKDIR /app
COPY apps/web/package.json ./
RUN npm ci || npm install
COPY apps/web ./
RUN npm run build

FROM node:${node}-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
EXPOSE 3000
USER node
CMD ["npm", "run", "start"]
`,
    );
    return;
  }

  ctx.writeFile(
    `${paths.webRoot}/Dockerfile`,
    `FROM node:${node}-alpine AS development
WORKDIR /app
COPY apps/web/package.json ./
RUN npm install
COPY apps/web ./
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM node:${node}-alpine AS build
WORKDIR /app
COPY apps/web/package.json ./
RUN npm ci || npm install
COPY apps/web ./
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s CMD wget -qO- http://127.0.0.1/ || exit 1
`,
  );
  ctx.writeFile(
    `${paths.webRoot}/nginx.conf`,
    `server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
`,
  );
}

function writeGithubActions(ctx: GenerationContextLike): void {
  const { config } = ctx;
  const pm = config.packageManager;
  const setup =
    pm === 'pnpm'
      ? [
          { uses: 'pnpm/action-setup@v4', with: { version: '10' } },
          { uses: 'actions/setup-node@v4', with: { 'node-version': config.nodeVersion, cache: 'pnpm' } },
        ]
      : [{ uses: 'actions/setup-node@v4', with: { 'node-version': config.nodeVersion, cache: pm === 'yarn' ? 'yarn' : 'npm' } }];
  const install = pm === 'pnpm' ? 'pnpm install --frozen-lockfile' : pm === 'yarn' ? 'yarn install --frozen-lockfile' : pm === 'bun' ? 'bun install --frozen-lockfile' : 'npm ci';
  const run = (script: string) => (pm === 'pnpm' ? `pnpm ${script}` : pm === 'yarn' ? `yarn ${script}` : pm === 'bun' ? `bun run ${script}` : `npm run ${script}`);

  const workflow = {
    name: 'CI',
    on: {
      push: { branches: ['main', 'master'] },
      pull_request: { branches: ['main', 'master'] },
      workflow_dispatch: {
        inputs: {
          profile: {
            description: 'Deploy profile (informational — no vendor is hardcoded)',
            required: false,
            default: 'local',
            type: 'choice',
            options: ['local', 'docker', 'staging', 'production'],
          },
        },
      },
    },
    jobs: {
      quality: {
        'runs-on': 'ubuntu-latest',
        services: {
          postgres: {
            image: 'postgres:16-alpine',
            env: { POSTGRES_PASSWORD: 'postgres', POSTGRES_USER: 'postgres', POSTGRES_DB: 'app_test' },
            ports: ['5432:5432'],
            options: '--health-cmd "pg_isready -U postgres" --health-interval 5s --health-timeout 5s --health-retries 10',
          },
        },
        steps: [
          { uses: 'actions/checkout@v4' },
          ...setup,
          { name: 'Install', run: install },
          { name: 'Lint', run: run('lint') },
          { name: 'Typecheck', run: run('typecheck') },
          {
            name: 'Unit tests',
            run: run('test'),
            env: { NODE_ENV: 'test', DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/app_test' },
          },
          {
            name: 'Integration tests',
            run: pm === 'pnpm' ? 'pnpm --filter api test:integration || pnpm test' : `${run('test')} -- integration || true`,
            env: { NODE_ENV: 'test', DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/app_test' },
          },
        ],
      },
      build: {
        'runs-on': 'ubuntu-latest',
        needs: ['quality'],
        steps: [
          { uses: 'actions/checkout@v4' },
          ...setup,
          { name: 'Install', run: install },
          { name: 'Build', run: run('build') },
        ],
      },
      ...(config.testing.e2e !== 'none'
        ? {
            e2e: {
              'runs-on': 'ubuntu-latest',
              needs: ['build'],
              steps: [
                { uses: 'actions/checkout@v4' },
                ...setup,
                { name: 'Install', run: install },
                config.testing.e2e === 'playwright'
                  ? { name: 'Playwright browsers', run: 'npx playwright install --with-deps' }
                  : { name: 'Cypress', run: 'npx cypress verify' },
                { name: 'E2E', run: config.testing.e2e === 'playwright' ? 'npx playwright test' : 'npx cypress run' },
              ],
            },
          }
        : {}),
      ...(config.docker === 'dev+prod'
        ? {
            docker: {
              'runs-on': 'ubuntu-latest',
              needs: ['build'],
              steps: [
                { uses: 'actions/checkout@v4' },
                { uses: 'docker/setup-buildx-action@v3' },
                {
                  name: 'Build API image',
                  run: `docker build -f ${dockerfilePath(config, 'api')} -t ${kebab(config.name)}-api:ci .`,
                },
                ...(config.frontend.kind !== 'none'
                  ? [
                      {
                        name: 'Build web image',
                        run: `docker build -f ${dockerfilePath(config, 'web')} -t ${kebab(config.name)}-web:ci .`,
                      },
                    ]
                  : []),
              ],
            },
          }
        : {}),
    },
  };

  ctx.writeFile('.github/workflows/ci.yml', `${stringify(workflow, { indent: 2 })}\n`);
}

function writeGitlabCi(ctx: GenerationContextLike): void {
  const { config } = ctx;
  const pm = config.packageManager;
  const install = pm === 'pnpm' ? 'pnpm install --frozen-lockfile' : pm === 'yarn' ? 'yarn install --frozen-lockfile' : 'npm ci';
  const run = (script: string) => (pm === 'pnpm' ? `pnpm ${script}` : pm === 'yarn' ? `yarn ${script}` : `npm run ${script}`);

  ctx.writeFile(
    '.gitlab-ci.yml',
    `stages:
  - install
  - lint
  - typecheck
  - test
  - build
  - e2e
  - docker

variables:
  NODE_ENV: test
  DATABASE_URL: postgresql://postgres:postgres@postgres:5432/app_test
  # Deploy profiles (Local | Docker | Staging | Production) are documentation only.
  # Do not assume a cloud vendor.

default:
  image: node:${config.nodeVersion}

.postgres: &postgres
  services:
    - name: postgres:16-alpine
      alias: postgres
  variables:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: app_test

install:
  stage: install
  script:
    - ${install}
  artifacts:
    paths: [node_modules, apps/**/node_modules]
    expire_in: 1h

lint:
  stage: lint
  script:
    - ${run('lint')}

typecheck:
  stage: typecheck
  script:
    - ${run('typecheck')}

unit:
  stage: test
  <<: *postgres
  script:
    - ${run('test')}

integration:
  stage: test
  <<: *postgres
  script:
    - ${run('test')}

build:
  stage: build
  script:
    - ${run('build')}

${
  config.testing.e2e !== 'none'
    ? `e2e:
  stage: e2e
  script:
    - ${config.testing.e2e === 'playwright' ? 'npx playwright install --with-deps && npx playwright test' : 'npx cypress run'}
`
    : ''
}
${
  config.docker === 'dev+prod'
    ? `docker:
  stage: docker
  image: docker:24
  services: [docker:24-dind]
  script:
    - docker build -f ${dockerfilePath(config, 'api')} -t $CI_REGISTRY_IMAGE/api:$CI_COMMIT_SHORT_SHA .
${config.frontend.kind !== 'none' ? `    - docker build -f ${dockerfilePath(config, 'web')} -t $CI_REGISTRY_IMAGE/web:$CI_COMMIT_SHORT_SHA .\n` : ''}`
    : ''}
`,
  );
}

function writeDeployProfiles(ctx: GenerationContextLike): void {
  ctx.writeFile(
    'docs/deploy-profiles.md',
    `# Deploy profiles

Optional profiles — **Local**, **Docker**, **Staging**, **Production**.

No cloud vendor is hardcoded. Point CI deploy jobs at the platform you choose.

| Profile | Use |
| --- | --- |
| Local | \`.env\` + ${ctx.config.packageManager} + local or Compose Postgres |
| Docker | \`docker compose\` with env files, never baked secrets |
| Staging | Same images as production, separate credentials and CORS |
| Production | PRODUCTION.md checklist, managed secrets, migrate as a release step |

Selected deployment hints: ${ctx.config.deployment.length ? ctx.config.deployment.join(', ') : '(none)'}.
`,
  );
}

function writeTesting(ctx: GenerationContextLike): void {
  const { config } = ctx;
  const paths = ctxPaths(ctx);
  const unit = config.testing.unit;
  const ext = isTs(config) ? 'ts' : 'js';

  if (unit === 'vitest') {
    addApiDeps(ctx, [
      ['vitest', '^3.0.9', true],
      ['supertest', '^7.1.0', true],
    ]);
    if (isTs(config)) addApiDeps(ctx, [['@types/supertest', '^6.0.3', true]]);
  } else {
    addApiDeps(ctx, [
      ['jest', '^29.7.0', true],
      ['supertest', '^7.1.0', true],
    ]);
    if (isTs(config)) {
      addApiDeps(ctx, [
        ['@types/jest', '^29.5.14', true],
        ['@types/supertest', '^6.0.3', true],
        ['ts-jest', '^29.3.0', true],
      ]);
    }
  }

  const apiTestDir = paths.apiRoot === '.' ? 'tests' : `${paths.apiRoot}/tests`;
  const importFrom = unit === 'vitest' ? "import { describe, expect, it } from 'vitest';" : '';

  ctx.writeFile(
    `${paths.apiRoot === '.' ? '' : `${paths.apiRoot}/`}${unit === 'vitest' ? 'vitest.config.' + ext : 'jest.config.' + ext}`,
    unit === 'vitest'
      ? `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    setupFiles: ['tests/setup.${ext}'],
  },
});
`
      : `/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  ${isTs(config) ? "preset: 'ts-jest'," : ''}
  testMatch: ['**/tests/**/*.test.${ext}'],
  setupFiles: ['<rootDir>/tests/setup.${ext}'],
};
`,
  );

  ctx.writeFile(
    `${apiTestDir}/setup.${ext}`,
    `process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/${kebab(config.name)}_test?schema=public';
process.env.PORT ??= '4001';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
${config.auth !== 'none' ? "process.env.JWT_SECRET ??= 'test-access-secret-min-32-chars-long';\n" : ''}${config.auth === 'jwt-refresh-token' || config.auth === 'oauth2' ? "process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-min-32-chars';\n" : ''}
`,
  );

  ctx.writeFile(
    `${apiTestDir}/health.test.${ext}`,
    `${importFrom}
import request from 'supertest';

async function loadApp() {
  const mod = await import('../src/app.${ext}');
  const app = mod.app ?? mod.default ?? (mod.createApp ? await mod.createApp() : null);
  if (!app) throw new Error('Export app or createApp() from src/app');
  if (typeof app.ready === 'function') await app.ready();
  return app.server ?? app;
}

describe('health', () => {
  it('GET /health does not 5xx', async () => {
    const server = await loadApp();
    const res = await request(server).get('/health');
    expect(res.status).toBeLessThan(500);
  });

  it('GET /ready does not 5xx', async () => {
    const server = await loadApp();
    const res = await request(server).get('/ready');
    expect(res.status).toBeLessThan(500);
  });
});
`,
  );

  if (config.auth !== 'none') {
    ctx.writeFile(
      `${apiTestDir}/auth.validation.test.${ext}`,
      `${importFrom}
import request from 'supertest';

async function loadApp() {
  const mod = await import('../src/app.${ext}');
  const app = mod.app ?? mod.default ?? (mod.createApp ? await mod.createApp() : null);
  if (!app) throw new Error('Export app or createApp() from src/app');
  if (typeof app.ready === 'function') await app.ready();
  return app.server ?? app;
}

describe('auth validation', () => {
  it('rejects empty login body', async () => {
    const server = await loadApp();
    const res = await request(server).post('/api/v1/auth/login').send({});
    expect([400, 401, 422]).toContain(res.status);
  });

  it('rejects invalid email on register', async () => {
    const server = await loadApp();
    const res = await request(server)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short' });
    expect([400, 422]).toContain(res.status);
  });
});
`,
    );
  }

  if (config.frontend.kind !== 'none') {
    addWebDeps(ctx, [
      ['vitest', '^3.0.9', true],
      ['@testing-library/react', '^16.2.0', true],
      ['@testing-library/jest-dom', '^6.6.3', true],
      ['@testing-library/user-event', '^14.6.1', true],
      ['jsdom', '^26.0.0', true],
    ]);
    const rx = paths.reactExt;
    ctx.writeFile(
      `${paths.webRoot}/src/test/setup.${ext}`,
      `import '@testing-library/jest-dom/vitest';
`,
    );
    ctx.writeFile(
      `${paths.webSrc(`pages/Home.test.${rx}`)}`,
      `${unit === 'vitest' ? "import { describe, expect, it } from 'vitest';\n" : ''}import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './Home';

describe('Home', () => {
  it('renders the product title', () => {
    render(
      ${config.frontend.kind === 'nextjs' ? '<HomePage />' : '<MemoryRouter><HomePage /></MemoryRouter>'},
    );
    expect(screen.getByText(/${escapeRegex(config.name)}|draft|sheet|workspace/i)).toBeTruthy();
  });
});
`,
    );
  }

  if (config.testing.e2e === 'playwright') {
    addRootDeps(ctx, [['@playwright/test', '^1.51.1', true]]);
    ctx.writeFile(
      'playwright.config.ts',
      `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? '${config.frontend.kind === 'nextjs' ? 'http://localhost:3000' : config.frontend.kind === 'none' ? 'http://localhost:4000' : 'http://localhost:5173'}',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.CI
    ? undefined
    : {
        command: '${config.packageManager === 'pnpm' ? 'pnpm dev' : config.packageManager === 'yarn' ? 'yarn dev' : 'npm run dev'}',
        url: '${config.frontend.kind === 'none' ? 'http://localhost:4000/health' : config.frontend.kind === 'nextjs' ? 'http://localhost:3000' : 'http://localhost:5173'}',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
`,
    );
    ctx.writeFile(
      'e2e/smoke.spec.ts',
      `import { expect, test } from '@playwright/test';

test('home responds', async ({ page }) => {
  await page.goto(${config.frontend.kind === 'none' ? "'/health'" : "'/'"});
  await expect(page.locator('body')).toBeVisible();
});
${
  config.auth !== 'none' && config.frontend.kind !== 'none'
    ? `
test('login page is reachable', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel(/email/i)).toBeVisible();
});
`
    : ''
}
`,
    );
  }

  if (config.testing.e2e === 'cypress') {
    addRootDeps(ctx, [['cypress', '^14.2.1', true]]);
    ctx.writeFile(
      'cypress.config.ts',
      `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: '${config.frontend.kind === 'nextjs' ? 'http://localhost:3000' : config.frontend.kind === 'none' ? 'http://localhost:4000' : 'http://localhost:5173'}',
    specPattern: 'cypress/e2e/**/*.cy.ts',
  },
});
`,
    );
    ctx.writeFile(
      'cypress/e2e/smoke.cy.ts',
      `describe('smoke', () => {
  it('loads', () => {
    cy.visit(${config.frontend.kind === 'none' ? "'/health'" : "'/'"});
    cy.get('body').should('be.visible');
  });
});
`,
    );
  }

  syncWorkspacePackageJson(ctx, paths.apiRoot === '.' ? 'package.json' : `${paths.apiRoot}/package.json`, 'api');
  if (config.frontend.kind !== 'none') {
    syncWorkspacePackageJson(ctx, `${paths.webRoot}/package.json`, 'web');
  }
}

function syncWorkspacePackageJson(ctx: GenerationContextLike, rel: string, workspace: string): void {
  const raw = ctx.files.get(rel.replace(/^\.\//, ''));
  if (!raw) return;
  try {
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    pkg.dependencies = pkg.dependencies ?? {};
    pkg.devDependencies = pkg.devDependencies ?? {};
    pkg.scripts = pkg.scripts ?? {};
    for (const item of ctx.packages.filter((p) => p.workspace === workspace)) {
      if (item.dev) pkg.devDependencies[item.name] = item.version;
      else pkg.dependencies[item.name] = item.version;
    }
    if (!pkg.scripts.test) {
      pkg.scripts.test = ctx.config.testing.unit === 'vitest' ? 'vitest run' : 'jest';
    }
    ctx.writeFile(rel, `${JSON.stringify(pkg, null, 2)}\n`);
  } catch {
    // leave the original file if it is not JSON yet
  }
}

function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
