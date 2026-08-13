import { pathsFor } from '../core/paths.js';
import {
  emptyValidation,
  type Generator,
  type GenerationContextLike,
  type StarterConfig,
  type ValidationResult,
} from '../core/types.js';

export class AgentsGenerator implements Generator {
  id(): string {
    return 'agents';
  }

  supports(): boolean {
    return true;
  }

  validate(): ValidationResult {
    return emptyValidation();
  }

  async generate(ctx: GenerationContextLike): Promise<void> {
    const { config } = ctx;
    ctx.writeFile('.agents/architecture.md', architectureMd(config));
    ctx.writeFile('.agents/backend.md', backendMd(config));
    ctx.writeFile('.agents/frontend.md', frontendMd(config));
    ctx.writeFile('.agents/database.md', databaseMd(config));
    ctx.writeFile('.agents/security.md', securityMd(config));
    ctx.writeFile('.agents/testing.md', testingMd(config));

    ctx.writeFile('.agents/skills/pern-conventions/SKILL.md', conventionsSkill(config));
    ctx.writeFile('.agents/skills/add-api-module/SKILL.md', addApiModuleSkill(config));
    ctx.writeFile('.agents/skills/change-database/SKILL.md', changeDatabaseSkill(config));
    ctx.writeFile('.agents/skills/write-tests/SKILL.md', writeTestsSkill(config));
    ctx.writeFile('.agents/skills/harden-auth/SKILL.md', hardenAuthSkill(config));
    if (config.frontend.kind !== 'none') {
      ctx.writeFile('.agents/skills/add-web-feature/SKILL.md', addWebFeatureSkill(config));
    }
  }
}

function skill(name: string, description: string, body: string): string {
  return `---
name: ${name}
description: ${description}
---

${body.trim()}
`;
}

function architectureMd(config: StarterConfig): string {
  const paths = pathsFor(config);
  const usesRepo =
    config.designPatterns.includes('repository') ||
    ['repository', 'clean', 'hexagonal', 'ddd', 'modular-monolith'].includes(config.architecture);
  const usesUseCase =
    ['clean', 'hexagonal', 'ddd'].includes(config.architecture) ||
    config.designPatterns.includes('use-case');
  const logicHome = usesUseCase ? 'application use-cases (and domain services)' : 'services';

  return `# Architecture

This project is a PERN starter using **${config.architecture}** (${config.architectures.join(', ')}).

Design patterns in play: ${config.designPatterns.join(', ') || 'none extra'}.

## Placement

- Business logic belongs in ${logicHome}.
- Controllers must remain thin: parse, authorize, call a service/use-case, map the response.
- ${usesRepo ? 'Persistence goes through repositories. Do not query the ORM from controllers.' : 'Repositories are not part of this configuration. Keep data access in services — do not invent a repository layer.'}
- ${config.cqrs !== 'none' ? `CQRS mode is ${config.cqrs}: keep commands and queries separate.` : 'Do not introduce CQRS unless the configuration is changed.'}
- ${config.events !== 'none' ? `Domain/application events use ${config.events}.` : 'Do not add an event bus unless configured.'}

## Layout

- API root: \`${paths.apiRoot}\`
- ${config.frontend.kind === 'none' ? 'No web app.' : `Web root: \`${paths.webRoot}\``}
- Follow the generated folders. Do not flatten a modular monolith into a single controllers dump, and do not invent microservice packages unless \`microservice-ready\` work is requested.

## Hard rules

- Follow the generated architecture.
- Validate all external input at the edge.
- Do not access \`process.env\` outside config modules.
- Do not bypass authorization.
- Do not expose secrets in logs, responses, or the client bundle.
- Add tests for business-critical changes.
`;
}

function backendMd(config: StarterConfig): string {
  const apiPath =
    config.backend.api === 'graphql'
      ? 'GraphQL'
      : config.backend.api === 'rest+graphql'
        ? 'REST + GraphQL'
        : 'REST /api/v1';
  return `# Backend

Framework: **${config.backend.framework}**. API: **${apiPath}**. Language: **${config.language}**. Validation: **${config.validation}**. Logging: **${config.logging}**.

## Structure

- Thin ${config.backend.framework} route handlers / controllers.
- Business rules live in services${config.designPatterns.includes('use-case') ? ' or use-cases' : ''}.
- ${config.designPatterns.includes('dto') ? 'Use DTOs/mappers at the HTTP boundary.' : 'Keep response shapes explicit; do not leak ORM entities if avoidable.'}
- Middleware: helmet, cors, rate limit, auth, error handler — register in a stable order.

## Config

- Read environment only through \`src/config\`.
- Fail fast on missing required env in production.
- Never import \`process.env\` from services, repositories, or routes.

## Auth & tenancy

- Auth strategy: **${config.auth}**. Password hash: **${config.auth === 'none' ? 'n/a' : config.passwordHash}**.
- RBAC: **${config.rbac}**. ${config.rbac === 'none' ? 'Do not add role checks unless RBAC is enabled.' : 'Enforce roles/permissions on the server. UI hiding is not security.'}
- ${config.multiTenancy === 'none' ? 'Single-tenant. Do not add tenant_id filters unless tenancy is enabled.' : `Multi-tenancy: ${config.multiTenancy}. Scope every query by tenant.`}
${config.auditLog ? '- Write audit records for privileged mutations.\n' : ''}
## Errors

- Map domain errors to HTTP in one error middleware.
- Do not leak stacks or SQL in production responses.
`;
}

function frontendMd(config: StarterConfig): string {
  if (config.frontend.kind === 'none') {
    return `# Frontend

This starter is **API-only**. Do not add \`apps/web\` unless the configuration changes.

If you introduce a client later: keep refresh tokens in HttpOnly cookies, never localStorage.
`;
  }

  const ui =
    config.frontend.ui === 'shadcn'
      ? 'Tailwind + shadcn-like primitives in components/ui'
      : config.frontend.ui === 'none'
        ? 'plain drafting-table CSS — do not sneak in shadcn/MUI'
        : config.frontend.ui;
  const state = config.frontend.state === 'none' ? 'no global client store' : config.frontend.state;
  const serverState =
    config.frontend.serverState === 'none'
      ? 'fetch in hooks/pages — still do not dump server lists into the auth store'
      : config.frontend.serverState;

  return `# Frontend

App: **${config.frontend.kind}** in \`apps/web\`. UI: **${ui}**. Router: ${config.frontend.router ? 'yes' : 'minimal'}.

## State

- Client store: **${state}**. Use it for auth session UI and ephemeral UI only.
- Server state: **${serverState}**.
- Do not put server collections (users, orders, lists) in the global store.
- API client: **${config.frontend.apiClient}** in \`src/services/api.ts\`. Auth calls in \`src/services/auth.ts\`.

## Auth

- Strategy: **${config.auth}**.
- Prefer HttpOnly cookies with \`withCredentials\` / \`credentials: 'include'\`.
- On 401, retry once after \`POST /auth/refresh\`. Do not persist refresh tokens in localStorage.
- Guest routes redirect when authenticated; protected routes redirect to login.
${config.rbac !== 'none' ? '- Role routes are extra UI. Backend authorization is still required.\n' : ''}
## UI

- Do not hard-code shadcn if another UI kit is selected.
- Keep the drafting-table look: paper \`#F7F5F2\`, ink \`#1C1917\`, copper \`#B45309\`, IBM Plex Sans / Mono, hairline borders, tabular numbers.
- Forms: **${config.frontend.forms}**. Validation: **${config.frontend.validation}**.

## Folders

\`components/\`, \`features/\`, \`pages/\`, \`layouts/\`, \`hooks/\`, \`lib/\`, \`services/\`, \`stores/\`, \`types/\`, \`utils/\`, \`routes/\`.
`;
}

function databaseMd(config: StarterConfig): string {
  return `# Database

PostgreSQL with **${config.orm}**. Pagination: **${config.pagination}**.

## Rules

- ${config.designPatterns.includes('repository') || ['clean', 'hexagonal', 'ddd', 'repository'].includes(config.architecture) ? 'Repositories own queries. Services do not embed raw SQL unless the ORM is `pg`.' : 'Keep SQL/ORM usage in the data access area of the selected architecture — not in controllers.'}
- Validate all external input before it reaches the database.
- Use parameterized queries. Never concatenate SQL.
- Wrap multi-table writes in transactions.
- ${config.multiTenancy === 'none' ? 'No tenant column required.' : `Isolate tenants (${config.multiTenancy}).`}
- Only generate tables that match features: auth refresh tokens, RBAC roles, tenants, audit logs — when those features are on.
- Migrations are the source of truth. Do not "fix prod" by editing schema in place.
- Seed data is for development. Never seed production secrets.
`;
}

function securityMd(config: StarterConfig): string {
  return `# Security

- Do not expose secrets. Example env files only; real \`.env\` is gitignored.
- Do not access \`process.env\` outside config modules.
- Do not bypass authorization. Every privileged route checks auth${config.rbac !== 'none' ? ' and RBAC' : ''} on the server.
- Validate all external input (${config.validation}) — body, query, params, headers you trust.
- Auth: **${config.auth}**. Refresh tokens: HttpOnly cookies, rotation, reuse detection. Never default to localStorage.
- Passwords: **${config.auth === 'none' ? 'n/a' : config.passwordHash}**. Never log passwords or tokens.
- CORS is an allow-list, not \`*\` with credentials.
- Uploads: size, MIME, and path checks if storage is enabled (${config.storage}).
- ${config.auditLog ? 'Audit privileged actions with actor, action, resource, timestamp.' : 'Do not log sensitive payloads.'}
- Docker/compose: no hardcoded production secrets. Inject via env.
`;
}

function testingMd(config: StarterConfig): string {
  return `# Testing

Unit runner: **${config.testing.unit}**. E2E: **${config.testing.e2e}**. Backend HTTP tests: Supertest.

## Expectation

- Add tests for business-critical changes (auth, permissions, money, tenancy, inventory).
- Keep tests aligned with the generated architecture — test services/use-cases, not only controllers.
- API tests cover validation, authentication, and ${config.rbac !== 'none' ? 'authorization' : 'happy-path handlers'}.
${config.frontend.kind !== 'none' ? `- Frontend: ${config.testing.unit} + React Testing Library for pages/hooks.` : '- No frontend test suite (API-only).'}
${config.testing.e2e !== 'none' ? `- E2E (${config.testing.e2e}): login/register/dashboard smoke when auth is enabled.` : '- No E2E runner selected.'}

## Do not

- Hit real production databases.
- Commit credentials into fixtures.
- Skip auth tests because "the UI hides the button".
`;
}

function conventionsSkill(config: StarterConfig): string {
  return skill(
    'pern-conventions',
    `Applies this generated PERN project's standing conventions (${config.architecture}, ${config.backend.framework}, ${config.orm}). Use when adding features, reviewing code, or changing architecture, auth, database, or frontend files.`,
    `
# PERN conventions

Read these project files before changing code:

- [.agents/architecture.md](../../architecture.md)
- [.agents/backend.md](../../backend.md)
- [.agents/frontend.md](../../frontend.md)
- [.agents/database.md](../../database.md)
- [.agents/security.md](../../security.md)
- [.agents/testing.md](../../testing.md)

This app is **${config.name}**: ${config.language}, ${config.backend.framework}, ${config.orm}, auth **${config.auth}**, frontend **${config.frontend.kind}**.

Follow the generated layout. Do not invent layers, ORMs, or auth stores that are not selected.
`,
  );
}

function addApiModuleSkill(config: StarterConfig): string {
  const paths = pathsFor(config);
  const usesRepo =
    config.designPatterns.includes('repository') ||
    ['repository', 'clean', 'hexagonal', 'ddd', 'modular-monolith'].includes(config.architecture);
  const usesUseCase =
    ['clean', 'hexagonal', 'ddd'].includes(config.architecture) ||
    config.designPatterns.includes('use-case');

  return skill(
    'add-api-module',
    `Adds an API module matching this project's ${config.architecture} layout under ${paths.apiRoot}. Use when creating a new resource, controller, service, route, or CRUD endpoint.`,
    `
# Add an API module

API root: \`${paths.apiRoot}\`. Framework: **${config.backend.framework}**. Validation: **${config.validation}**.

## Steps

1. Read [.agents/architecture.md](../../architecture.md) and [.agents/backend.md](../../backend.md).
2. Create the module next to existing ones. Do not dump new files into a flat \`controllers/\` folder if modules already exist.
3. Add: routes → thin controller → ${usesUseCase ? 'use-case / ' : ''}service${usesRepo ? ' → repository' : ''}.
4. Validate body/query/params with **${config.validation}** at the edge.
5. ${config.auth === 'none' ? 'Auth is off. Do not add authenticate middleware unless asked.' : 'Protect privileged routes with the generated auth middleware.'}
6. ${config.rbac === 'none' ? 'RBAC is off. Do not invent role checks.' : 'Authorize on the server with the generated RBAC helpers.'}
7. Register the router in the v1 index.
8. Add tests (see the \`write-tests\` skill).

## Do not

- Query ${config.orm} from a controller.
- Read \`process.env\` in the new module.
- Return ORM entities if DTOs/mappers are in use (${config.designPatterns.includes('dto') ? 'they are' : 'keep shapes explicit anyway'}).
`,
  );
}

function changeDatabaseSkill(config: StarterConfig): string {
  return skill(
    'change-database',
    `Changes PostgreSQL schema with ${config.orm} migrations for this generated app. Use when adding tables, columns, relations, or seed data.`,
    `
# Change the database

ORM: **${config.orm}**. Pagination: **${config.pagination}**.

## Steps

1. Read [.agents/database.md](../../database.md).
2. Update the ${config.orm} schema / model files that already exist. Do not add a second ORM.
3. Add a migration. Do not edit production by hand.
4. ${config.designPatterns.includes('repository') || ['clean', 'hexagonal', 'ddd', 'repository'].includes(config.architecture) ? 'Put queries in repositories, not services or controllers.' : 'Keep queries in the data-access area of the selected architecture.'}
5. Use parameterized queries only.
6. Wrap multi-table writes in a transaction.
7. ${config.multiTenancy === 'none' ? 'Do not add tenant_id unless tenancy is enabled.' : `Scope every query by tenant (${config.multiTenancy}).`}
8. Update seed data for local/dev only.

## Do not

- Concatenate SQL.
- Commit real secrets into seeds.
- Generate auth/RBAC/tenant tables that are not selected.
`,
  );
}

function writeTestsSkill(config: StarterConfig): string {
  return skill(
    'write-tests',
    `Writes ${config.testing.unit} and ${config.testing.e2e === 'none' ? 'API' : config.testing.e2e} tests for this PERN starter. Use when adding features, fixing bugs, or covering auth, payments, or tenancy.`,
    `
# Write tests

Unit: **${config.testing.unit}**. HTTP: Supertest. E2E: **${config.testing.e2e}**.

## Steps

1. Read [.agents/testing.md](../../testing.md).
2. Prefer testing services/use-cases, then HTTP handlers.
3. Cover validation failures, ${config.auth === 'none' ? 'happy-path handlers' : 'unauthenticated 401s'}, and ${config.rbac === 'none' ? 'success paths' : 'forbidden roles'}.
4. ${config.frontend.kind === 'none' ? 'No frontend tests unless a web app is added.' : `Frontend: ${config.testing.unit} + React Testing Library for pages and hooks.`}
5. ${config.testing.e2e === 'none' ? 'No E2E runner is selected.' : `E2E (${config.testing.e2e}): login/register/dashboard smoke when auth is on.`}

## Do not

- Hit production databases.
- Commit credentials in fixtures.
- Treat a hidden UI button as authorization.
`,
  );
}

function hardenAuthSkill(config: StarterConfig): string {
  return skill(
    'harden-auth',
    `Extends or reviews authentication and authorization for this app (strategy ${config.auth}, RBAC ${config.rbac}). Use when changing login, refresh tokens, cookies, roles, or protected routes.`,
    `
# Auth and security

Strategy: **${config.auth}**. Hash: **${config.auth === 'none' ? 'n/a' : config.passwordHash}**. RBAC: **${config.rbac}**.

## Steps

1. Read [.agents/security.md](../../security.md) and [.agents/backend.md](../../backend.md).
2. ${config.auth === 'none' ? 'Auth is disabled. Do not add JWT/session unless the user asks to enable it.' : 'Keep refresh tokens in HttpOnly cookies with rotation and reuse detection. Never localStorage.'}
3. ${config.rbac === 'none' ? 'Do not add role middleware unless RBAC is enabled.' : 'Enforce permissions on the server. UI hiding is not security.'}
4. Validate every external input with **${config.validation}**.
5. Read env only from config modules.
6. CORS stays an allow-list.

## Do not

- Log passwords or tokens.
- Bypass authenticate/authorize middleware.
- Expose stacks or SQL in production errors.
`,
  );
}

function addWebFeatureSkill(config: StarterConfig): string {
  const paths = pathsFor(config);
  return skill(
    'add-web-feature',
    `Adds a React + Vite page, feature, or form in ${paths.webRoot} using ${config.frontend.ui}, ${config.frontend.state}, and ${config.frontend.serverState}. Use when building UI, routes, hooks, or client API calls.`,
    `
# Add a web feature

Web root: \`${paths.webRoot}\`. UI: **${config.frontend.ui}**. Client state: **${config.frontend.state}**. Server state: **${config.frontend.serverState}**. Forms: **${config.frontend.forms}**.

## Steps

1. Read [.agents/frontend.md](../../frontend.md).
2. Put UI in \`features/\` or \`pages/\`. Reuse \`components/ui\` if it exists.
3. Call the API from \`src/services\`. Do not fetch from random components with a new client.
4. Keep ${config.frontend.state === 'none' ? 'no extra global store' : `${config.frontend.state} for session/UI only`}.
5. Keep lists and server records in **${config.frontend.serverState === 'none' ? 'page/hooks' : config.frontend.serverState}**, not the auth store.
6. Cookies: \`credentials: 'include'\` / \`withCredentials\`. On 401, refresh once.
7. Validate forms with **${config.frontend.validation}**.

## Do not

- Persist refresh tokens in localStorage.
- Switch UI kits (${config.frontend.ui} is selected).
- Treat frontend route guards as backend authorization.
`,
  );
}
