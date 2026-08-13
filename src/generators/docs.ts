import { pathsFor } from '../core/paths.js';
import { emptyValidation, type Generator, type GenerationContextLike, type StarterConfig, type ValidationResult } from '../core/types.js';

export class DocsGenerator implements Generator {
  id(): string {
    return 'docs';
  }

  supports(): boolean {
    return true;
  }

  validate(): ValidationResult {
    return emptyValidation();
  }

  async generate(ctx: GenerationContextLike): Promise<void> {
    const { config } = ctx;
    ctx.writeFile('ARCHITECTURE.md', architectureDoc(config));
    ctx.writeFile('API.md', apiDoc(config));
    ctx.writeFile('AUTH.md', authDoc(config));
    ctx.writeFile('DATABASE.md', databaseDoc(config));
    ctx.writeFile('DEPLOYMENT.md', deploymentDoc(config));
    ctx.writeFile('DOCKER.md', dockerDoc(config));
    ctx.writeFile('TESTING.md', testingDoc(config));
    ctx.writeFile('SECURITY.md', securityDoc(config));
    ctx.writeFile('AI_CONTEXT.md', aiContextDoc(config));
    if (config.openapi !== 'none') {
      ctx.writeFile('docs/openapi.yaml', openApiSpec(config));
    }
  }
}

function architectureDoc(config: StarterConfig): string {
  const paths = pathsFor(config);
  const logic =
    ['clean', 'hexagonal', 'ddd'].includes(config.architecture) || config.designPatterns.includes('use-case')
      ? 'use-cases / application services'
      : 'services';
  const repos = config.designPatterns.includes('repository') || ['repository', 'clean', 'hexagonal', 'ddd', 'modular-monolith'].includes(config.architecture);

  return `# Architecture

**${config.name}** uses **${config.architecture}** (also selected: ${config.architectures.join(', ')}).

## Intent

${archBlurb(config)}

## Source layout

- API: \`${paths.apiRoot}\`
${config.frontend.kind === 'none' ? '- Frontend: none (API-only)' : `- Web: \`${paths.webRoot}\``}
${config.admin === 'none' ? '' : `- Admin: \`${paths.adminRoot}\``}

## Rules for this configuration

1. Business logic lives in ${logic}.
2. Controllers/route handlers stay thin.
3. ${repos ? 'Repositories isolate persistence. Do not query Prisma/Drizzle/pg from controllers.' : 'No repository layer was generated. Keep data access inside services.'}
4. Validate every external payload with **${config.validation}**.
5. Read environment only from config modules.
6. ${config.cqrs === 'none' ? 'CQRS is off. Do not split command/query models for simple CRUD.' : `CQRS is ${config.cqrs}.`}
7. ${config.events === 'none' ? 'No event bus.' : `Events: ${config.events}.`}
8. ${config.multiTenancy === 'none' ? 'Single tenant.' : `Tenancy: ${config.multiTenancy}.`}

## Design patterns

${config.designPatterns.map((id) => `- \`${id}\``).join('\n') || '- (none beyond the architecture default)'}

## Request path

\`HTTP → middleware (auth, validate) → controller → ${logic}${repos ? ' → repository' : ''} → PostgreSQL\`
`;
}

function archBlurb(config: StarterConfig): string {
  switch (config.architecture) {
    case 'simple-mvc':
      return 'Controllers, services, and routes with minimal layering.';
    case 'layered':
      return 'Presentation, business, and data layers with a one-way dependency rule.';
    case 'service-layer':
      return 'Controllers delegate to services that own transactions and rules.';
    case 'repository':
      return 'Persistence is hidden behind repository interfaces.';
    case 'modular-monolith':
      return 'Feature modules own their routes, services, and data. Cross-module calls go through public APIs, not deep imports.';
    case 'clean':
      return 'Domain at the center; application use-cases; infrastructure and HTTP at the edges.';
    case 'hexagonal':
      return 'Ports define what the application needs; adapters implement Postgres, HTTP, mail, and queues.';
    case 'ddd':
      return 'Bounded contexts, aggregates, and domain events. Keep the domain free of Express/Fastify types.';
    case 'cqrs':
      return 'Commands and queries are separate models.';
    case 'event-driven':
      return 'Modules communicate with events rather than tight service calls.';
    case 'microservice-ready':
      return 'Module boundaries are ready to extract later. Do not split processes until asked.';
    case 'monorepo':
      return 'Apps and packages in one repository. Shared types belong in packages, not copied.';
    case 'multi-tenant':
      return 'Every query and job is tenant-scoped.';
    default:
      return 'Follow the generated folders.';
  }
}

function apiDoc(config: StarterConfig): string {
  const versioned = config.backend.api !== 'graphql';
  return `# API

- Framework: **${config.backend.framework}**
- Style: **${config.backend.api}**${config.backend.graphqlServer ? ` (${config.backend.graphqlServer})` : ''}
${versioned ? '- Version prefix: `/api/v1`' : '- GraphQL endpoint: `/graphql`'}
- Pagination: **${config.pagination}**
- OpenAPI: **${config.openapi}**

## Health

\`GET /health\` — liveness  
\`GET /ready\` — database${config.cache === 'redis' ? ' + Redis' : ''} readiness

Do not put secrets or internal hostnames in health payloads.

## Errors

JSON shape:

\`\`\`json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is invalid",
    "details": [{ "path": "email", "message": "Invalid email" }]
  }
}
\`\`\`

Typical codes: \`VALIDATION_ERROR\`, \`UNAUTHORIZED\`, \`FORBIDDEN\`, \`NOT_FOUND\`, \`CONFLICT\`, \`RATE_LIMITED\`, \`INTERNAL_ERROR\`.

## Pagination

${config.pagination === 'offset' || config.pagination === 'both' ? 'Offset: `?page=1&pageSize=20` → `{ items, page, pageSize, total }`.' : ''}
${config.pagination === 'cursor' || config.pagination === 'both' ? 'Cursor: `?cursor=<id>&limit=20` → `{ items, nextCursor }`.' : ''}

## Filtering

Use explicit query DTOs. Reject unknown operators. Combine with tenant and auth scopes.

${config.openapi !== 'none' ? 'Machine-readable spec: [docs/openapi.yaml](./docs/openapi.yaml).' : 'OpenAPI was not selected.'}
${config.openapi === 'swagger' ? 'Swagger UI is mounted at `/api/docs` in non-production by default.' : ''}
`;
}

function authDoc(config: StarterConfig): string {
  if (config.auth === 'none') {
    return `# Auth

Authentication is **disabled**. Public routes only.

Do not add JWT/session code until auth is enabled in the starter config. Protect nothing on the client that the API does not enforce — there is no user model required.
`;
  }

  return `# Auth

Strategy: **${config.auth}**  
Password hashing: **${config.passwordHash}**  
RBAC: **${config.rbac}**  
OAuth providers: ${config.oauthProviders.length ? config.oauthProviders.join(', ') : 'none'}

## Flows

Register → validate → hash password → create user → issue access token${config.auth === 'jwt-refresh-token' || config.auth === 'oauth2' ? ' → issue rotating refresh token (HttpOnly cookie)' : ''}

Refresh${config.auth === 'jwt' || config.auth === 'session' ? ' (if applicable)' : ''}: validate → rotate → revoke old → set new cookie. Reuse of a revoked refresh token must kill the family.

Logout: revoke refresh token / destroy session.

## Cookies

Refresh tokens are **HttpOnly**, \`Secure\` in production, \`SameSite=Lax\` (or \`None\` only with HTTPS cross-site).  
The SPA calls the API with \`withCredentials\` / \`credentials: 'include'\`.  
**Never store refresh tokens in localStorage by default.**

## Frontend

- Public: \`/\`, \`/login\`, \`/register\`
- Guest: login/register redirect away if already authenticated
- Protected: \`/dashboard\`
${config.rbac !== 'none' ? '- Role routes: admin pages require roles from the API, not only a React guard' : ''}

Backend authorization is mandatory even when the UI hides a button.
`;
}

function databaseDoc(config: StarterConfig): string {
  return `# Database

- Engine: PostgreSQL
- Access: **${config.orm}**
- Tenancy: **${config.multiTenancy}**

## Expected models (only if the feature is on)

| Feature | Tables |
| --- | --- |
| Auth | User${config.auth === 'jwt-refresh-token' || config.auth === 'oauth2' ? ', RefreshToken' : ''}${config.auth === 'session' ? ', Session' : ''} |
| RBAC (${config.rbac}) | ${config.rbac === 'none' ? '—' : 'Role, Permission, join tables'} |
| Tenancy | ${config.multiTenancy === 'none' ? '—' : 'Tenant + tenant_id on tenant-owned rows'} |
| Audit | ${config.auditLog ? 'AuditLog' : '—'} |

## Migrations

Use the root script \`db:migrate\`. Do not auto-migrate production on boot.

## Seeding

\`db:seed\` is for local/dev. It must not insert production secrets or real customer PII.
`;
}

function deploymentDoc(config: StarterConfig): string {
  const profiles = config.deployment.length
    ? config.deployment.join(', ')
    : 'Local, Docker, Staging, Production (no vendor locked in)';
  return `# Deployment

Selected profiles/hints: **${profiles}**

This starter does **not** assume Railway, Render, Fly, AWS, Vercel, or any other vendor. Wire the platform in CI yourself.

## Profiles

### Local

1. Copy env examples to \`.env\`
2. ${install(config)} 
3. Start Postgres${config.cache === 'redis' ? ' and Redis' : ''}${config.docker !== 'none' ? ' (\`docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d\`)' : ''}
4. \`db:migrate\` then \`dev\`

### Docker

Use Compose. Inject secrets via environment or a secret manager. Do not bake \`.env\` into images.

### Staging

- Separate database and credentials
- CORS limited to the staging origin
- Same image pipeline as production

### Production

See PRODUCTION.md. Run migrations as a release job. Set \`NODE_ENV=production\`.

## CI

${config.cicd === 'none' ? 'No CI provider selected. Add GitHub Actions or GitLab CI when ready.' : `Pipeline: **${config.cicd}** (install → lint → typecheck → unit → integration → build → e2e → docker build).`}
`;
}

function dockerDoc(config: StarterConfig): string {
  if (config.docker === 'none') {
    return `# Docker

Docker is **not** selected. Run PostgreSQL (and Redis if enabled) locally or point \`DATABASE_URL\` at a hosted instance.

Compose files are omitted on purpose. Enable \`docker: dev\` or \`dev+prod\` to generate them.
`;
  }

  return `# Docker

Mode: **${config.docker}**

## Files

- \`docker-compose.yml\` — base services
- \`docker-compose.dev.yml\` — bind mounts / published ports
${config.docker === 'dev+prod' ? '- `docker-compose.prod.yml` — production-style images, no hardcoded secrets\n' : ''}

## Services included

Only services implied by the config are generated (api${config.frontend.kind !== 'none' ? ', web' : ''}, postgres${config.cache === 'redis' ? ', redis' : ''}${config.mailpit ? ', mailpit' : ''}${config.storage === 'minio' ? ', minio' : ''}).

## Commands

\`\`\`bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
docker compose ps
\`\`\`

Health checks gate \`depends_on\`. Do not put production passwords in YAML — use \`\${POSTGRES_PASSWORD}\` and similar.
`;
}

function testingDoc(config: StarterConfig): string {
  return `# Testing

- Unit: **${config.testing.unit}**
- HTTP: Supertest
- Frontend: ${config.frontend.kind === 'none' ? 'n/a' : `${config.testing.unit} + React Testing Library`}
- E2E: **${config.testing.e2e}**

## Layers

| Layer | Where |
| --- | --- |
| Unit | services / use-cases |
| Integration | ORM + Postgres test database |
| API | Supertest against the app (auth validation, health) |
| Component | React Testing Library |
| E2E | ${config.testing.e2e === 'none' ? 'not generated' : config.testing.e2e} |

CRUD placeholders are generated only where they match enabled features (auth, health). Do not invent Product tests unless a Product module exists.

Use \`.env.test.example\` as the template for the test environment.
`;
}

function securityDoc(config: StarterConfig): string {
  return `# Security

## Baseline

- Helmet, CORS allow-list, rate limiting
- ${config.validation} on all external input
- Auth: **${config.auth}**
- RBAC: **${config.rbac}**
- Secrets only in env; examples have placeholders

## Tokens

Refresh tokens (when enabled) are HttpOnly cookies. Access tokens are short-lived. Do not log Authorization headers.

## Config discipline

Do not read \`process.env\` in business logic. Centralize in \`src/config\`.

## Authorization

Never trust the frontend. ${config.rbac === 'none' ? 'If you add roles later, enforce them on the API.' : 'Role and permission checks belong in backend middleware/policies.'}

## Production

Follow PRODUCTION.md. Rotate JWT secrets, disable public Swagger in production if it exposes internals, and keep Docker images free of \`.env\` files.
`;
}

function aiContextDoc(config: StarterConfig): string {
  const paths = pathsFor(config);
  return `# AI context

You are working in **${config.name}**, a generated PERN (${config.language}) application.

## Selected architecture

- Primary: **${config.architecture}**
- Also: ${config.architectures.join(', ')}
- Patterns: ${config.designPatterns.join(', ') || 'n/a'}
- API: ${config.backend.framework} / ${config.backend.api} / ${config.orm} / PostgreSQL
- Auth: ${config.auth} / RBAC ${config.rbac}
- Frontend: ${config.frontend.kind} / UI ${config.frontend.ui} / state ${config.frontend.state} / server state ${config.frontend.serverState}
- Validation: ${config.validation} (API) / ${config.frontend.validation} (web)
- Cache ${config.cache} / queue ${config.queue} / storage ${config.storage} / email ${config.email}
- Monorepo tool: ${config.monorepo}
- Paths: API \`${paths.apiRoot}\`${config.frontend.kind === 'none' ? '' : `, web \`${paths.webRoot}\``}

## Non-negotiables

- Business logic in services/use-cases; thin controllers
- Repositories only when this architecture/patterns include them
- Validate all external input
- Do not access process.env outside config
- Do not bypass authorization
- Do not expose secrets
- Follow the generated architecture
- Add tests for business-critical changes
- Do not put server lists into the frontend global store
- Refresh tokens: HttpOnly cookies, not localStorage

## Agent files

Follow \`.agents/*.md\` and the skills under \`.agents/skills/\`. Do not add \`.cursor/rules/*.mdc\`.

## What not to invent

Do not add Stripe, Redis, Kafka, tenants, or an admin app unless those features are selected above.
`;
}

function openApiSpec(config: StarterConfig): string {
  const hasAuth = config.auth !== 'none';
  const offset = config.pagination === 'offset' || config.pagination === 'both';
  const cursor = config.pagination === 'cursor' || config.pagination === 'both';
  return `openapi: 3.1.0
info:
  title: ${config.name} API
  version: 1.0.0
  description: Generated PERN starter API (${config.backend.framework}, ${config.backend.api}).
servers:
  - url: http://localhost:4000/api/v1
    description: Local
tags:
  - name: Health
  - name: Auth
  - name: Users
paths:
  /health:
    get:
      tags: [Health]
      summary: Liveness
      responses:
        '200':
          description: Process is up
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Health'
              example:
                status: ok
                services:
                  database: ok
  /ready:
    get:
      tags: [Health]
      summary: Readiness
      responses:
        '200':
          description: Dependencies reachable
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Health'
        '503':
          description: A dependency is down
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
${hasAuth ? authPaths(config) : ''}
  /users:
    get:
      tags: [Users]
      summary: List users
      security: ${hasAuth ? '[{ bearerAuth: [] }, { cookieAuth: [] }]' : '[]'}
      parameters:
${offset ? `        - in: query\n          name: page\n          schema: { type: integer, minimum: 1, default: 1 }\n        - in: query\n          name: pageSize\n          schema: { type: integer, minimum: 1, maximum: 100, default: 20 }\n` : ''}${cursor ? `        - in: query\n          name: cursor\n          schema: { type: string }\n        - in: query\n          name: limit\n          schema: { type: integer, minimum: 1, maximum: 100, default: 20 }\n` : ''}        - in: query
          name: q
          schema: { type: string }
          description: Optional search string
      responses:
        '200':
          description: Paginated users
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserList'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
  /users/me:
    get:
      tags: [Users]
      summary: Current user
      security: ${hasAuth ? '[{ bearerAuth: [] }, { cookieAuth: [] }]' : '[]'}
      responses:
        '200':
          description: Profile
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '401':
          $ref: '#/components/responses/Unauthorized'
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    cookieAuth:
      type: apiKey
      in: cookie
      name: refresh_token
  responses:
    Unauthorized:
      description: Missing or invalid credentials
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: UNAUTHORIZED
              message: Invalid or expired access token
    Forbidden:
      description: Authenticated but not allowed
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
    ValidationError:
      description: Request failed validation
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: VALIDATION_ERROR
              message: Invalid request
              details:
                - path: email
                  message: Invalid email
  schemas:
    Health:
      type: object
      properties:
        status:
          type: string
          enum: [ok, degraded]
        services:
          type: object
          additionalProperties:
            type: string
    ErrorResponse:
      type: object
      properties:
        error:
          type: object
          properties:
            code: { type: string }
            message: { type: string }
            details:
              type: array
              items:
                type: object
                properties:
                  path: { type: string }
                  message: { type: string }
    User:
      type: object
      properties:
        id: { type: string, format: uuid }
        email: { type: string, format: email }
        name: { type: string }
        roles:
          type: array
          items: { type: string }
        createdAt: { type: string, format: date-time }
    UserList:
      type: object
      properties:
        items:
          type: array
          items:
            $ref: '#/components/schemas/User'
        page: { type: integer }
        pageSize: { type: integer }
        total: { type: integer }
        nextCursor: { type: string, nullable: true }
    LoginRequest:
      type: object
      required: [email, password]
      properties:
        email: { type: string, format: email }
        password: { type: string, minLength: 8 }
    RegisterRequest:
      type: object
      required: [email, password]
      properties:
        email: { type: string, format: email }
        password: { type: string, minLength: 8 }
        name: { type: string }
    AuthResponse:
      type: object
      properties:
        user:
          $ref: '#/components/schemas/User'
        accessToken:
          type: string
          description: Short-lived JWT. Refresh token is set as HttpOnly cookie, not in this body.
`;
}

function authPaths(config: StarterConfig): string {
  return `  /auth/register:
    post:
      tags: [Auth]
      summary: Register
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterRequest'
            example:
              email: dev@example.com
              password: correcthorse
              name: Dev User
      responses:
        '201':
          description: Created; refresh cookie may be set
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '400':
          $ref: '#/components/responses/ValidationError'
        '409':
          description: Email taken
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
  /auth/login:
    post:
      tags: [Auth]
      summary: Login
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
            example:
              email: dev@example.com
              password: correcthorse
      responses:
        '200':
          description: Authenticated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'
  /auth/refresh:
    post:
      tags: [Auth]
      summary: Rotate refresh token (HttpOnly cookie)
      responses:
        '200':
          description: New access token; new refresh cookie
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'
  /auth/logout:
    post:
      tags: [Auth]
      summary: Revoke refresh token / session
      responses:
        '204':
          description: Logged out
`;
}

function install(config: StarterConfig): string {
  switch (config.packageManager) {
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
