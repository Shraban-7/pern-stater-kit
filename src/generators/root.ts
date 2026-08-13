import { STARTER_VERSION, emptyValidation, type Generator, type GenerationContextLike, type Manifest, type PackageManager, type StarterConfig, type ValidationResult } from '../core/types.js';
import { ctxPaths } from './helpers.js';
import { addRootDeps } from './helpers.js';

const GENERATOR_VERSION = '1.0.0';

export class RootGenerator implements Generator {
  id(): string {
    return 'root';
  }

  supports(): boolean {
    return true;
  }

  validate(): ValidationResult {
    return emptyValidation();
  }

  async generate(ctx: GenerationContextLike): Promise<void> {
    const { config } = ctx;
    const paths = ctxPaths(ctx);
    const tools = new Set(config.codeQuality);
    const hasFrontend = config.frontend.kind !== 'none';
    const hasAdmin = config.admin !== 'none';
    const isWorkspace = paths.isMonorepo || hasAdmin;

    if (hasFrontend) {
      const prefix = config.frontend.kind === 'nextjs' ? 'NEXT_PUBLIC' : 'VITE';
      ctx.addEnv({
        key: `${prefix}_API_URL`,
        example: 'http://localhost:4000/api/v1',
        required: true,
        description: 'Public API base URL for the web app',
        workspace: 'web',
      });
      ctx.addEnv({
        key: `${prefix}_APP_NAME`,
        example: config.name,
        required: true,
        description: 'Browser-visible application name',
        workspace: 'web',
      });
    }

    writeGitignore(ctx, isWorkspace);
    ctx.writeFile('.nvmrc', `${config.nodeVersion}\n`);
    writePackageManifest(ctx, isWorkspace, tools);
    writeWorkspaceFiles(ctx, isWorkspace);
    writeCodeQuality(ctx, tools);
    writeEnvExamples(ctx);
    writeStarterJson(ctx);
    writeReadme(ctx);
    writeProductionChecklist(ctx);

    ctx.addScript('dev', rootScript(config, isWorkspace, 'dev'));
    ctx.addScript('build', rootScript(config, isWorkspace, 'build'));
    ctx.addScript('lint', rootScript(config, isWorkspace, 'lint'));
    ctx.addScript('test', rootScript(config, isWorkspace, 'test'));
    ctx.addScript('db:migrate', apiScript(ctx, migrateCommand(config)));
    ctx.addScript('db:seed', apiScript(ctx, 'db:seed'));
  }
}

function writePackageManifest(
  ctx: GenerationContextLike,
  isWorkspace: boolean,
  tools: Set<string>,
): void {
  const { config } = ctx;
  const existingRaw = ctx.files.get('package.json');
  const existing = existingRaw ? (JSON.parse(existingRaw) as Record<string, unknown>) : {};
  const existingScripts =
    existing.scripts && typeof existing.scripts === 'object'
      ? (existing.scripts as Record<string, string>)
      : {};
  const existingDeps =
    existing.dependencies && typeof existing.dependencies === 'object'
      ? (existing.dependencies as Record<string, string>)
      : {};
  const existingDevDeps =
    existing.devDependencies && typeof existing.devDependencies === 'object'
      ? (existing.devDependencies as Record<string, string>)
      : {};

  const rootPkgs: Array<[string, string, boolean?]> = [];
  if (config.monorepo === 'turborepo') rootPkgs.push(['turbo', '^2.4.4', true]);
  if (config.monorepo === 'nx') rootPkgs.push(['nx', '^20.6.4', true]);
  if (tools.has('eslint')) {
    rootPkgs.push(['eslint', '^9.23.0', true], ['@eslint/js', '^9.23.0', true], ['globals', '^16.0.0', true]);
    if (config.language === 'typescript') {
      rootPkgs.push(['typescript-eslint', '^8.28.0', true], ['typescript', '^5.8.2', true]);
    }
    if (tools.has('prettier')) rootPkgs.push(['eslint-config-prettier', '^10.1.1', true]);
  }
  if (tools.has('prettier')) rootPkgs.push(['prettier', '^3.5.3', true]);
  if (tools.has('biome')) rootPkgs.push(['@biomejs/biome', '^1.9.4', true]);
  if (tools.has('husky')) rootPkgs.push(['husky', '^9.1.7', true]);
  if (tools.has('lint-staged')) rootPkgs.push(['lint-staged', '^15.5.0', true]);
  if (tools.has('commitlint')) {
    rootPkgs.push(
      ['@commitlint/cli', '^19.8.0', true],
      ['@commitlint/config-conventional', '^19.8.0', true],
    );
  }

  const { dependencies, devDependencies } = collectRoot(ctx, rootPkgs);

  for (const pkg of ctx.packages.filter((item) => item.workspace === 'root')) {
    if (pkg.dev) devDependencies[pkg.name] = pkg.version;
    else dependencies[pkg.name] = pkg.version;
  }

  const scripts: Record<string, string> = {
    ...existingScripts,
    dev: rootScript(config, isWorkspace, 'dev'),
    build: rootScript(config, isWorkspace, 'build'),
    lint: lintScript(config, isWorkspace, tools),
    test: rootScript(config, isWorkspace, 'test'),
    typecheck: typecheckScript(config, isWorkspace),
    format: formatScript(tools),
    'db:migrate': apiScript(ctx, migrateCommand(config)),
    'db:seed': apiScript(ctx, 'db:seed'),
  };

  if (config.orm === 'prisma') {
    scripts['db:generate'] = apiScript(ctx, 'db:generate');
    scripts['db:studio'] = apiScript(ctx, 'db:studio');
  }

  if (tools.has('husky')) {
    scripts.prepare = 'husky';
  }

  const pkg: Record<string, unknown> = {
    ...existing,
    name: kebabName(config.name),
    version: existing.version ?? '0.1.0',
    private: true,
    type: existing.type ?? 'module',
    engines: {
      node: `>=${config.nodeVersion}`,
    },
    scripts,
    dependencies: sortRecord({ ...existingDeps, ...dependencies }),
    devDependencies: sortRecord({ ...existingDevDeps, ...devDependencies }),
  };

  if (isWorkspace) {
    if (config.packageManager !== 'pnpm') {
      pkg.workspaces = ['apps/*', 'packages/*'];
    }
  }

  if (config.packageManager === 'pnpm') {
    pkg.packageManager = 'pnpm@10.6.5';
  } else if (config.packageManager === 'yarn') {
    pkg.packageManager = 'yarn@1.22.22';
  } else if (config.packageManager === 'bun') {
    pkg.packageManager = 'bun@1.2.5';
  } else {
    pkg.packageManager = 'npm@10.9.2';
  }

  if (tools.has('lint-staged')) {
    pkg['lint-staged'] = tools.has('biome')
      ? { '*.{js,jsx,ts,tsx,json,md}': ['biome check --write --no-errors-on-unmatched'] }
      : {
          '*.{js,jsx,ts,tsx}': tools.has('eslint') ? ['eslint --fix'] : [],
          '*.{js,jsx,ts,tsx,json,md,yml,yaml,css}': tools.has('prettier')
            ? ['prettier --write']
            : [],
        };
  }

  ctx.writeFile('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
}

function collectRoot(
  ctx: GenerationContextLike,
  items: Array<[string, string, boolean?]>,
): { dependencies: Record<string, string>; devDependencies: Record<string, string> } {
  addRootDeps(ctx, items);
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};
  for (const [name, version, dev] of items) {
    if (dev) devDependencies[name] = version;
    else dependencies[name] = version;
  }
  return { dependencies, devDependencies };
}

function writeWorkspaceFiles(ctx: GenerationContextLike, isWorkspace: boolean): void {
  const { config } = ctx;
  if (!isWorkspace) return;

  if (config.packageManager === 'pnpm' || config.monorepo === 'pnpm' || config.monorepo === 'turborepo') {
    ctx.writeFile(
      'pnpm-workspace.yaml',
      ['packages:', "  - 'apps/*'", "  - 'packages/*'", ''].join('\n'),
    );
  }

  if (config.monorepo === 'turborepo') {
    ctx.writeFile(
      'turbo.json',
      `${JSON.stringify(
        {
          $schema: 'https://turbo.build/schema.json',
          tasks: {
            build: {
              dependsOn: ['^build'],
              outputs: ['dist/**', '.next/**', '!.next/cache/**'],
            },
            dev: { cache: false, persistent: true },
            lint: {},
            test: { dependsOn: ['^build'] },
            typecheck: { dependsOn: ['^build'] },
            'db:migrate': { cache: false },
            'db:seed': { cache: false },
          },
        },
        null,
        2,
      )}\n`,
    );
  }

  if (config.monorepo === 'nx') {
    ctx.writeFile(
      'nx.json',
      `${JSON.stringify(
        {
          $schema: './node_modules/nx/schemas/nx-schema.json',
          namedInputs: {
            default: ['{projectRoot}/**/*', 'sharedGlobals'],
            sharedGlobals: [],
            production: ['default', '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)'],
          },
          targetDefaults: {
            build: { dependsOn: ['^build'], cache: true },
            lint: { cache: true },
            test: { cache: true },
            typecheck: { cache: true },
          },
        },
        null,
        2,
      )}\n`,
    );
  }
}

function writeCodeQuality(ctx: GenerationContextLike, tools: Set<string>): void {
  const { config } = ctx;

  if (tools.has('prettier')) {
    ctx.writeFile(
      '.prettierrc',
      `${JSON.stringify(
        {
          singleQuote: true,
          trailingComma: 'all',
          printWidth: 90,
          semi: true,
        },
        null,
        2,
      )}\n`,
    );
    ctx.writeFile('.prettierignore', ['node_modules', 'dist', 'coverage', '.next', '.turbo', ''].join('\n'));
  }

  if (tools.has('eslint')) {
    const ts = config.language === 'typescript';
    const prettier = tools.has('prettier');
    ctx.writeFile(
      'eslint.config.js',
      `${ts ? "import tseslint from 'typescript-eslint';\n" : ''}import js from '@eslint/js';
import globals from 'globals';
${prettier ? "import prettier from 'eslint-config-prettier';\n" : ''}
export default ${ts ? 'tseslint.config' : '['}(
  { ignores: ['**/dist/**', '**/coverage/**', '**/.next/**', '**/.turbo/**', '**/node_modules/**'] },
  js.configs.recommended,
  ${ts ? '...tseslint.configs.recommended,' : ''}
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  ${prettier ? 'prettier,' : ''}
${ts ? ');\n' : '];\n'}`,
    );
  }

  if (tools.has('biome')) {
    ctx.writeFile(
      'biome.json',
      `${JSON.stringify(
        {
          $schema: 'https://biomejs.dev/schemas/1.9.4/schema.json',
          vcs: { enabled: true, clientKind: 'git', useIgnoreFile: true },
          files: { ignore: ['dist', 'coverage', '.next', '.turbo', 'node_modules'] },
          formatter: { enabled: true, indentStyle: 'space', indentWidth: 2 },
          linter: { enabled: true, rules: { recommended: true } },
          organizeImports: { enabled: true },
        },
        null,
        2,
      )}\n`,
    );
    if (tools.has('prettier')) {
      ctx.addNote('Both Biome and Prettier are selected. They overlap; keep one formatter in CI if possible.');
    }
  }

  if (tools.has('commitlint')) {
    ctx.writeFile(
      'commitlint.config.js',
      "export default { extends: ['@commitlint/config-conventional'] };\n",
    );
  }

  if (tools.has('husky')) {
    ctx.writeFile(
      '.husky/pre-commit',
      `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

${tools.has('lint-staged') ? 'npx lint-staged' : tools.has('biome') ? 'npx biome check .' : 'npm run lint'}
`,
    );
  }
}

function writeGitignore(ctx: GenerationContextLike, isWorkspace: boolean): void {
  const pm = ctx.config.packageManager;
  const unusedLockfiles: string[] = [];
  if (pm !== 'npm') unusedLockfiles.push('package-lock.json');
  if (pm !== 'pnpm') unusedLockfiles.push('pnpm-lock.yaml');
  if (pm !== 'yarn') unusedLockfiles.push('yarn.lock');
  if (pm !== 'bun') unusedLockfiles.push('bun.lock', 'bun.lockb');

  const lines = [
    '# dependencies',
    'node_modules',
    '',
    '# build',
    'dist',
    'build',
    'coverage',
    '.turbo',
    '.nx',
    '.next',
    'out',
    '',
    '# environment — never commit real secrets',
    '.env',
    '.env.local',
    '.env.*.local',
    '!.env.example',
    '!.env.test.example',
    '!.env.staging.example',
    '!.env.production.example',
    '',
    '# logs / os',
    'logs',
    '*.log',
    '.DS_Store',
    'Thumbs.db',
    '',
    '# test / e2e artifacts',
    'playwright-report',
    'test-results',
    'cypress/videos',
    'cypress/screenshots',
    '',
    '# unused lockfiles (this project uses ' + pm + ')',
    ...unusedLockfiles,
    '',
  ];

  if (isWorkspace) {
    lines.push('# generated clients', 'packages/api-client/src/generated', '');
  }

  ctx.writeFile('.gitignore', `${lines.join('\n')}\n`);
}

function writeEnvExamples(ctx: GenerationContextLike): void {
  const { config } = ctx;
  const paths = ctxPaths(ctx);
  const apiVars = ctx.env.filter((item) => (item.workspace ?? 'api') !== 'web');
  const webVars = ctx.env.filter((item) => item.workspace === 'web');

  const defaults = [
    { key: 'NODE_ENV', example: 'development', description: 'Runtime environment' },
    { key: 'PORT', example: '4000', description: 'API port' },
    { key: 'DATABASE_URL', example: `postgresql://postgres:postgres@localhost:5432/${kebabName(config.name)}?schema=public`, description: 'PostgreSQL connection string' },
    { key: 'CORS_ORIGIN', example: config.frontend.kind === 'none' ? 'http://localhost:4000' : 'http://localhost:5173', description: 'Allowed CORS origin' },
  ];

  if (config.auth === 'jwt' || config.auth === 'jwt-refresh-token' || config.auth === 'oauth2') {
    defaults.push({
      key: 'JWT_SECRET',
      example: 'change-me-access-secret-min-32-chars-long',
      description: 'Access token secret',
    });
  }
  if (config.auth === 'jwt-refresh-token' || config.auth === 'oauth2') {
    defaults.push({
      key: 'JWT_REFRESH_SECRET',
      example: 'change-me-refresh-secret-min-32-chars',
      description: 'Refresh token secret',
    });
    defaults.push({
      key: 'REFRESH_COOKIE_NAME',
      example: 'refresh_token',
      description: 'HttpOnly refresh cookie name',
    });
  }
  if (config.auth === 'session') {
    defaults.push({
      key: 'SESSION_SECRET',
      example: 'change-me-session-secret-min-32-chars',
      description: 'Session signing secret',
    });
  }
  if (config.cache === 'redis' || config.queue === 'bullmq') {
    defaults.push({ key: 'REDIS_URL', example: 'redis://localhost:6379', description: 'Redis connection URL' });
  }

  const seen = new Set(apiVars.map((item) => item.key));
  const mergedApi = [
    ...apiVars.map((item) => ({
      key: item.key,
      example: item.example,
      description: item.description,
      secret: item.secret,
    })),
    ...defaults
      .filter((item) => !seen.has(item.key))
      .map((item) => ({ ...item, secret: /SECRET|KEY|PASSWORD|TOKEN/i.test(item.key) })),
  ];

  const apiDir = paths.apiRoot === '.' ? '' : `${paths.apiRoot}/`;
  ctx.writeFile(`${apiDir}.env.example`, renderEnv(mergedApi, { emptySecrets: false, nodeEnv: 'development' }));
  ctx.writeFile(`${apiDir}.env.test.example`, renderEnv(mergedApi, { emptySecrets: false, nodeEnv: 'test' }));
  ctx.writeFile(`${apiDir}.env.staging.example`, renderEnv(mergedApi, { emptySecrets: true, nodeEnv: 'staging' }));
  ctx.writeFile(
    `${apiDir}.env.production.example`,
    renderEnv(mergedApi, { emptySecrets: true, nodeEnv: 'production' }),
  );

  if (config.frontend.kind !== 'none') {
    const prefix = config.frontend.kind === 'nextjs' ? 'NEXT_PUBLIC' : 'VITE';
    const webDefaults = [
      { key: `${prefix}_API_URL`, example: 'http://localhost:4000/api/v1', description: 'API base URL', secret: false },
      { key: `${prefix}_APP_NAME`, example: config.name, description: 'Application name', secret: false },
    ];
    const webSeen = new Set(webVars.map((item) => item.key));
    const mergedWeb = [
      ...webVars.map((item) => ({
        key: item.key,
        example: item.example,
        description: item.description,
        secret: Boolean(item.secret),
      })),
      ...webDefaults.filter((item) => !webSeen.has(item.key)),
    ];
    ctx.writeFile(`${paths.webRoot}/.env.example`, renderEnv(mergedWeb, { emptySecrets: false, nodeEnv: 'development' }));
    ctx.writeFile(
      `${paths.webRoot}/.env.production.example`,
      renderEnv(mergedWeb, { emptySecrets: false, nodeEnv: 'production' }),
    );
  }
}

function renderEnv(
  vars: Array<{ key: string; example: string; description: string; secret?: boolean }>,
  opts: { emptySecrets: boolean; nodeEnv: string },
): string {
  const lines = [
    '# Example environment file. Copy to .env and fill in real values.',
    '# Never commit .env — it is gitignored.',
    '',
  ];
  const used = new Set<string>();
  for (const item of vars) {
    if (used.has(item.key)) continue;
    used.add(item.key);
    lines.push(`# ${item.description}`);
    let value = item.example;
    if (item.key === 'NODE_ENV') value = opts.nodeEnv;
    if (opts.emptySecrets && item.secret) value = '';
    lines.push(`${item.key}=${value}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function writeStarterJson(ctx: GenerationContextLike): void {
  const manifest: Manifest = {
    version: STARTER_VERSION,
    stack: 'PERN',
    generatedAt: new Date().toISOString(),
    generatorVersion: GENERATOR_VERSION,
    config: ctx.config,
  };
  ctx.writeFile('starter.json', `${JSON.stringify(manifest, null, 2)}\n`);
}

function writeReadme(ctx: GenerationContextLike): void {
  const { config } = ctx;
  const paths = ctxPaths(ctx);
  const pm = installCmd(config.packageManager);
  const apiEnv =
    paths.apiRoot === '.'
      ? 'cp .env.example .env'
      : `cp ${paths.apiRoot}/.env.example ${paths.apiRoot}/.env`;
  const webEnv =
    config.frontend.kind === 'none'
      ? ''
      : `cp ${paths.webRoot}/.env.example ${paths.webRoot}/.env`;
  const docker = config.docker !== 'none' ? 'docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d' : '# start PostgreSQL locally';

  ctx.writeFile(
    'README.md',
    `# ${config.name}

Production-ready PERN starter generated by pern-starter.

## Stack

| Area | Choice |
| --- | --- |
| Backend | ${config.backend.framework} (${config.backend.api}) |
| Frontend | ${frontendLabel(config)} |
| Database | PostgreSQL + ${config.orm} |
| Auth | ${config.auth} |
| RBAC | ${config.rbac} |
| Architecture | ${config.architecture} |
| Cache | ${config.cache} |
| Queue | ${config.queue} |
| Testing | ${config.testing.unit}${config.testing.e2e !== 'none' ? ` + ${config.testing.e2e}` : ''} |
| Docker | ${config.docker === 'none' ? 'Disabled' : 'Enabled'} |
| Package manager | ${config.packageManager} |
| Node | ${config.nodeVersion} |

## Next steps

\`\`\`bash
cd ${config.name}

${apiEnv}
${webEnv}

${pm}

${docker}

${config.packageManager === 'pnpm' ? 'pnpm' : config.packageManager === 'yarn' ? 'yarn' : config.packageManager === 'bun' ? 'bun run' : 'npm run'} db:migrate

${config.packageManager === 'pnpm' ? 'pnpm' : config.packageManager === 'yarn' ? 'yarn' : config.packageManager === 'bun' ? 'bun run' : 'npm run'} dev
\`\`\`

API: \`http://localhost:4000\`
${config.frontend.kind === 'none' ? '' : config.frontend.kind === 'nextjs' ? 'Web: `http://localhost:3000`' : 'Web: `http://localhost:5173`'}

## Scripts

- \`dev\` — start ${paths.isMonorepo ? 'api and web' : 'the API'}
- \`build\` — production build
- \`lint\` — lint
- \`test\` — unit / integration tests
- \`db:migrate\` — run database migrations
- \`db:seed\` — seed development data

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [API.md](./API.md)
- [AUTH.md](./AUTH.md)
- [DATABASE.md](./DATABASE.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [DOCKER.md](./DOCKER.md)
- [TESTING.md](./TESTING.md)
- [SECURITY.md](./SECURITY.md)
- [AI_CONTEXT.md](./AI_CONTEXT.md)
- [PRODUCTION.md](./PRODUCTION.md)

## Production checklist

See [PRODUCTION.md](./PRODUCTION.md) before going live.
`,
  );
}

function writeProductionChecklist(ctx: GenerationContextLike): void {
  ctx.writeFile(
    'PRODUCTION.md',
    `# Production checklist

- [ ] Replace every example secret in \`.env.production\`
- [ ] Confirm \`.env\` is gitignored and never copied into images
- [ ] TLS termination in front of the API (and web if self-hosted)
- [ ] Restrict \`CORS_ORIGIN\` to real frontend origins
- [ ] Enable Helmet / security headers and rate limiting
- [ ] Refresh tokens stay HttpOnly + Secure + SameSite; never localStorage
- [ ] Database backups and restore drill
- [ ] Run migrations as a release step, not from the API process
- [ ] Health and readiness probes configured on the orchestrator
- [ ] Structured logs without PII or tokens
- [ ] Error tracking (${ctx.config.monitoring.includes('sentry') ? 'Sentry DSN set' : 'Sentry or equivalent'})
- [ ] Dependency audit and lockfile committed for ${ctx.config.packageManager} only
- [ ] CI: lint, typecheck, unit, integration, build, e2e
- [ ] Admin routes require server-side authorization, not only UI gates
`,
  );
}

function rootScript(config: StarterConfig, isWorkspace: boolean, task: string): string {
  if (!isWorkspace) {
    if (task === 'dev') return config.language === 'typescript' ? 'tsx watch src/server.ts' : 'node --watch src/server.js';
    if (task === 'build') return config.language === 'typescript' ? 'tsc -p tsconfig.json' : 'echo "no build step"';
    if (task === 'test') return config.testing.unit === 'vitest' ? 'vitest run' : 'jest';
    if (task === 'lint') return 'eslint .';
    return task;
  }
  if (config.monorepo === 'turborepo') return `turbo run ${task}`;
  if (config.monorepo === 'nx') return `nx run-many -t ${task}`;
  return recursiveScript(config.packageManager, task);
}

function typecheckScript(config: StarterConfig, isWorkspace: boolean): string {
  if (config.language !== 'typescript') return 'echo "JavaScript project — skip typecheck"';
  if (!isWorkspace) return 'tsc --noEmit';
  if (config.monorepo === 'turborepo') return 'turbo run typecheck';
  if (config.monorepo === 'nx') return 'nx run-many -t typecheck';
  return recursiveScript(config.packageManager, 'typecheck');
}

function lintScript(config: StarterConfig, isWorkspace: boolean, tools: Set<string>): string {
  if (tools.has('biome') && !tools.has('eslint')) return 'biome check .';
  if (!isWorkspace) return tools.has('eslint') ? 'eslint .' : 'echo "No linter configured"';
  if (config.monorepo === 'turborepo') return 'turbo run lint';
  if (config.monorepo === 'nx') return 'nx run-many -t lint';
  return recursiveScript(config.packageManager, 'lint');
}

function formatScript(tools: Set<string>): string {
  if (tools.has('biome') && !tools.has('prettier')) return 'biome format --write .';
  if (tools.has('prettier')) return 'prettier --write .';
  if (tools.has('biome')) return 'biome format --write .';
  return 'echo "No formatter configured"';
}

function recursiveScript(pm: PackageManager, task: string): string {
  switch (pm) {
    case 'pnpm':
      return `pnpm -r --if-present ${task}`;
    case 'yarn':
      return `yarn workspaces foreach -A --exclude root run ${task}`;
    case 'bun':
      return `bun run --filter '*' ${task}`;
    default:
      return `npm run ${task} --workspaces --if-present`;
  }
}

function apiScript(ctx: GenerationContextLike, script: string): string {
  const paths = ctxPaths(ctx);
  const pm = ctx.config.packageManager;
  if (paths.apiRoot === '.') {
    if (script.startsWith('prisma') || script.startsWith('drizzle') || script.startsWith('echo')) return script;
    return pm === 'pnpm' ? `pnpm ${script}` : pm === 'yarn' ? `yarn ${script}` : pm === 'bun' ? `bun run ${script}` : `npm run ${script}`;
  }
  return filterScript(pm, 'api', script);
}

function filterScript(pm: PackageManager, workspace: string, script: string): string {
  switch (pm) {
    case 'pnpm':
      return `pnpm --filter ${workspace} ${script}`;
    case 'yarn':
      return `yarn workspace ${workspace} ${script}`;
    case 'bun':
      return `bun run --filter ${workspace} ${script}`;
    default:
      return `npm run ${script} -w ${workspace}`;
  }
}

function migrateCommand(config: StarterConfig): string {
  switch (config.orm) {
    case 'prisma':
      return 'db:migrate';
    case 'drizzle':
      return 'db:migrate';
    case 'typeorm':
      return 'db:migrate';
    case 'sequelize':
      return 'db:migrate';
    case 'knex':
      return 'db:migrate';
    default:
      return 'db:migrate';
  }
}

function installCmd(pm: PackageManager): string {
  switch (pm) {
    case 'pnpm':
      return 'pnpm install';
    case 'yarn':
      return 'yarn';
    case 'bun':
      return 'bun install';
    default:
      return 'npm install';
  }
}

function kebabName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function frontendLabel(config: StarterConfig): string {
  if (config.frontend.kind === 'none') return 'API only';
  if (config.frontend.kind === 'nextjs') return `Next.js + ${config.frontend.ui}`;
  return `React + Vite + ${config.frontend.ui}`;
}

function sortRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}
