import { pathsFor } from '../core/paths.js';
import { emptyValidation, type Generator, type GenerationContextLike, type StarterConfig, type ValidationResult } from '../core/types.js';

export class CursorRulesGenerator implements Generator {
  id(): string {
    return 'cursor-rules';
  }

  supports(): boolean {
    return true;
  }

  validate(): ValidationResult {
    return emptyValidation();
  }

  async generate(ctx: GenerationContextLike): Promise<void> {
    const { config } = ctx;
    ctx.writeFile('.cursor/rules/architecture.mdc', architectureRule(config));
    ctx.writeFile('.cursor/rules/backend.mdc', backendRule(config));
    ctx.writeFile('.cursor/rules/frontend.mdc', frontendRule(config));
    ctx.writeFile('.cursor/rules/database.mdc', databaseRule(config));
    ctx.writeFile('.cursor/rules/security.mdc', securityRule(config));
    ctx.writeFile('.cursor/rules/testing.mdc', testingRule(config));
  }
}

function fence(body: string, extra: Record<string, string | boolean> = {}): string {
  const front: string[] = ['---', 'description: Generated PERN starter rule — follow the selected configuration'];
  for (const [key, value] of Object.entries(extra)) {
    front.push(`${key}: ${typeof value === 'boolean' ? value : value}`);
  }
  front.push('alwaysApply: true', '---', '');
  return `${front.join('\n')}${body.trim()}\n`;
}

function architectureRule(config: StarterConfig): string {
  const paths = pathsFor(config);
  const usesRepo = config.designPatterns.includes('repository') || ['repository', 'clean', 'hexagonal', 'ddd', 'modular-monolith'].includes(config.architecture);
  const usesUseCase = ['clean', 'hexagonal', 'ddd'].includes(config.architecture) || config.designPatterns.includes('use-case');
  const logicHome = usesUseCase ? 'application use-cases (and domain services)' : 'services';

  return fence(`
# Architecture

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
`);
}

function backendRule(config: StarterConfig): string {
  const apiPath = config.backend.api === 'graphql' ? 'GraphQL' : config.backend.api === 'rest+graphql' ? 'REST + GraphQL' : 'REST /api/v1';
  return fence(`
# Backend

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
${config.auditLog ? '- Write audit records for privileged mutations.' : ''}

## Errors

- Map domain errors to HTTP in one error middleware.
- Do not leak stacks or SQL in production responses.
`);
}

function frontendRule(config: StarterConfig): string {
  if (config.frontend.kind === 'none') {
    return fence(`
# Frontend

This starter is **API-only**. Do not add \`apps/web\` unless the configuration changes.

If you introduce a client later: keep refresh tokens in HttpOnly cookies, never localStorage.
`);
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

  return fence(`
# Frontend

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
${config.rbac !== 'none' ? '- Role routes are extra UI. Backend authorization is still required.' : ''}

## UI

- Do not hard-code shadcn if another UI kit is selected.
- Keep the drafting-table look: paper \`#F7F5F2\`, ink \`#1C1917\`, copper \`#B45309\`, IBM Plex Sans / Mono, hairline borders, tabular numbers.
- Forms: **${config.frontend.forms}**. Validation: **${config.frontend.validation}**.

## Folders

\`components/\`, \`features/\`, \`pages/\`, \`layouts/\`, \`hooks/\`, \`lib/\`, \`services/\`, \`stores/\`, \`types/\`, \`utils/\`, \`routes/\`.
`);
}

function databaseRule(config: StarterConfig): string {
  return fence(`
# Database

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
`);
}

function securityRule(config: StarterConfig): string {
  return fence(`
# Security

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
`);
}

function testingRule(config: StarterConfig): string {
  return fence(`
# Testing

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
`);
}
