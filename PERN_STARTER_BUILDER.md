# PERN Stack Starter Builder

## Professional Production-Ready PERN Project Generator

Version: 1.0  
Target: Cursor AI  
Stack: PostgreSQL + Express.js + React + Node.js  
Language: TypeScript by default  
Goal: Spring Initializr-style configurable full-stack starter generator.

---

# 1. Product Vision

Build a professional PERN starter generator where a developer selects exactly which features they need and the generator creates a production-ready project.

The system should support:

- PostgreSQL
- Node.js
- Express.js
- React
- TypeScript
- REST API
- GraphQL
- Authentication
- Authorization/RBAC
- OAuth
- Social login
- Database ORM
- Validation
- API documentation
- File storage
- Payments
- Email
- Notifications
- Redis
- Queues
- WebSockets
- Search
- Caching
- Logging
- Monitoring
- Docker
- Testing
- CI/CD
- Multiple frontend options
- Multiple architecture patterns
- CRUD generation
- Module generation
- Design-pattern generation
- Admin dashboard
- Multi-tenancy
- Background jobs
- Security hardening

Core principle:

> Generate only what the user selects. Avoid unnecessary packages, abstractions, and folders.

---

# 2. Primary CLI

Create a CLI named:

```bash
pern-starter
```

Main command:

```bash
pern-starter new my-app
```

Commands:

```bash
pern-starter new <project>

pern-starter list
pern-starter config
pern-starter validate
pern-starter status
pern-starter doctor
pern-starter update

pern-starter install <feature>
pern-starter remove <feature>

pern-starter make:crud <Entity>
pern-starter make:module <Module>
pern-starter make:controller <Name>
pern-starter make:service <Name>
pern-starter make:repository <Name>
pern-starter make:usecase <Name>
pern-starter make:dto <Name>
pern-starter make:schema <Name>
pern-starter make:middleware <Name>
pern-starter make:policy <Name>
pern-starter make:validator <Name>
pern-starter make:route <Name>
pern-starter make:event <Name>
pern-starter make:job <Name>
pern-starter make:worker <Name>
pern-starter make:component <Name>
pern-starter make:page <Name>
pern-starter make:hook <Name>
pern-starter make:store <Name>
pern-starter make:pattern <Pattern> <Name>

pern-starter patterns
pern-starter architectures
pern-starter features
```

Non-interactive:

```bash
pern-starter new ecommerce \
  --orm=prisma \
  --auth=jwt \
  --frontend=vite-react \
  --architecture=modular-monolith \
  --rbac=custom \
  --docker \
  --redis
```

Configuration file:

```bash
pern-starter new ecommerce --config=starter.yaml
```

Dry run:

```bash
pern-starter new ecommerce --dry-run
```

---

# 3. Interactive Wizard

Ask:

```text
Project name
Package manager
Node version
Language
Architecture
Design patterns
Backend framework
API style
Database ORM
Authentication
Authorization/RBAC
Frontend
UI framework
State management
Data fetching
Validation
Database
Cache
Queue
Storage
Email
Social login
OAuth
Payments
WebSockets
Search
Monitoring
Logging
Testing
Docker
CI/CD
Deployment
Admin dashboard
Multi-tenancy
CRUD generation
```

Before generation:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROJECT CONFIGURATION

Backend:
Express + TypeScript

Frontend:
React + Vite + TypeScript

Database:
PostgreSQL

ORM:
Prisma

Authentication:
JWT + Refresh Token

RBAC:
Custom

Architecture:
Modular Monolith

Infrastructure:
Redis + Docker

Payments:
Stripe

Testing:
Vitest + Playwright

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate project? [Y/n]
```

---

# 4. Language

Options:

```text
TypeScript
JavaScript
```

Default:

```text
TypeScript
```

TypeScript should use strict mode.

Recommended:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

---

# 5. Package Manager

Support:

```text
npm
pnpm
yarn
bun
```

Default:

```text
pnpm
```

Do not mix lockfiles.

---

# 6. Node.js

Support current supported Node LTS versions.

Generate:

```text
.nvmrc
```

and:

```text
engines
```

in package.json.

Validate installed Node version before generation.

---

# 7. Architecture Options

Support:

```text
Simple MVC
Layered Architecture
Service Layer
Repository Pattern
Modular Monolith
Clean Architecture
Hexagonal Architecture
DDD
CQRS
Event Driven
Microservice Ready
Monorepo
Multi-Tenant
```

Allow compatible combinations.

---

# 8. Recommended Default Architecture

For most applications:

```text
apps/
├── api/
└── web/
```

API:

```text
src/
├── config/
├── controllers/
├── middleware/
├── routes/
├── services/
├── repositories/
├── schemas/
├── utils/
├── types/
├── jobs/
├── events/
└── server.ts
```

Do not create DDD/CQRS complexity unless selected.

---

# 9. Modular Monolith

Structure:

```text
apps/api/src/modules/

├── auth/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── schemas/
│   ├── routes/
│   ├── types/
│   └── tests/
│
├── users/
├── products/
├── orders/
├── payments/
└── notifications/
```

Each module should own its:

- Routes
- Controllers
- Services
- Repositories
- Schemas
- Types
- Tests

---

# 10. Clean Architecture

Structure:

```text
src/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── repositories/
│   └── services/
│
├── application/
│   ├── use-cases/
│   ├── dto/
│   └── services/
│
├── infrastructure/
│   ├── database/
│   ├── repositories/
│   ├── adapters/
│   └── external/
│
└── presentation/
    ├── controllers/
    ├── routes/
    └── middleware/
```

Dependency rule:

```text
Presentation
     ↓
Application
     ↓
Domain

Infrastructure implements Domain/Application contracts.
```

---

# 11. Hexagonal Architecture

Support:

```text
Domain
Application
Ports
Adapters
```

Ports:

```text
UserRepository
PaymentGateway
EmailProvider
StorageProvider
NotificationProvider
```

Adapters:

```text
PrismaUserRepository
StripePaymentAdapter
ResendEmailAdapter
S3StorageAdapter
```

---

# 12. DDD

Support:

- Entities
- Aggregates
- Value Objects
- Domain Services
- Domain Events
- Repository Interfaces
- Specifications
- Application Services

Example:

```text
modules/order/

domain/
├── entities/
├── value-objects/
├── aggregates/
├── events/
├── services/
└── repositories/

application/
├── commands/
├── queries/
├── dto/
└── use-cases/

infrastructure/
├── persistence/
└── adapters/

presentation/
├── controllers/
└── routes/
```

---

# 13. CQRS

Options:

```text
Disabled
Basic CQRS
CQRS + Events
```

Commands:

```text
CreateOrderCommand
UpdateOrderCommand
CancelOrderCommand
```

Queries:

```text
GetOrderQuery
ListOrdersQuery
```

Handlers:

```text
CreateOrderHandler
GetOrderHandler
```

Never enable CQRS automatically for simple CRUD.

---

# 14. Design Patterns

Support GoF and backend patterns.

## Creational

```text
Factory
Abstract Factory
Builder
Prototype
Singleton
```

## Structural

```text
Adapter
Bridge
Composite
Decorator
Facade
Proxy
```

## Behavioral

```text
Strategy
Command
Observer
State
Chain of Responsibility
Mediator
Template Method
Specification
```

## Application Patterns

```text
Service Layer
Repository
Use Case
DTO
Mapper
Unit of Work
Specification
Domain Event
Event Bus
Saga
```

Generate only when selected.

---

# 15. Pattern Recommendation Engine

Example:

```text
Payment providers:
Stripe
PayPal
bKash

Recommended:

✓ Strategy
✓ Adapter
✓ Factory

Reason:
Multiple providers share one payment contract.
```

User must explicitly approve recommendations.

Warn against unnecessary Singleton usage.

---

# 16. Backend Framework

Primary:

```text
Express.js
```

Optional:

```text
Fastify
```

The generator should remain PERN-compatible.

Express default:

```text
app.ts
server.ts
routes/
controllers/
services/
middleware/
```

---

# 17. API Styles

Support:

```text
REST
GraphQL
REST + GraphQL
```

REST default.

GraphQL options:

```text
Apollo Server
GraphQL Yoga
```

---

# 18. REST API

Support:

- Versioning
- Pagination
- Filtering
- Sorting
- Search
- Validation
- Rate limiting
- Error handling
- API resources
- Request IDs
- Idempotency keys
- HTTP status conventions

Example:

```text
/api/v1/users
/api/v1/products
/api/v1/orders
```

---

# 19. API Response Standard

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {}
  }
}
```

Do not leak stack traces in production.

---

# 20. ORM / Database Access

Support:

```text
Prisma
Drizzle
TypeORM
Sequelize
Knex
Raw pg
```

Default recommendation:

```text
Prisma
```

Allow user selection.

---

# 21. Prisma

Generate:

```text
prisma/
├── schema.prisma
├── migrations/
└── seed.ts
```

Support:

- Migrations
- Relations
- Transactions
- Seeders
- Client generation
- Pagination
- Soft delete pattern
- Audit fields

Commands:

```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

---

# 22. PostgreSQL

Configure:

```env
DATABASE_URL=
```

Support:

- Transactions
- UUID
- JSONB
- Arrays
- Full text search where appropriate
- Indexes
- Constraints
- Foreign keys
- Unique constraints
- Check constraints

Do not create indexes without purpose.

---

# 23. Authentication

Options:

```text
None
JWT
Session
JWT + Refresh Token
OAuth2
```

Default API option:

```text
JWT + Refresh Token
```

Authentication must support:

- Registration
- Login
- Logout
- Refresh
- Password hashing
- Forgot password
- Reset password
- Email verification
- Account lockout/rate limiting
- Session/token revocation

---

# 24. JWT Architecture

Use:

```text
Access Token
Refresh Token
```

Recommended:

```text
Short-lived access token
Long-lived rotating refresh token
```

Never store sensitive refresh tokens in unsafe browser storage by default.

For browser applications, prefer secure, HttpOnly cookies where appropriate.

---

# 25. Password Hashing

Options:

```text
Argon2id
bcrypt
```

Default:

```text
Argon2id
```

Never store plaintext passwords.

---

# 26. OAuth

Support:

```text
Google
GitHub
Facebook
Microsoft
Apple
LinkedIn
```

Generate provider abstraction:

```text
OAuthProvider
GoogleProvider
GithubProvider
```

Use authorization-code based OAuth flows where appropriate.

---

# 27. RBAC

Options:

```text
None
Custom RBAC
CASL
AccessControl
```

Custom structure:

```text
users
roles
permissions
user_roles
role_permissions
```

Support:

```text
Admin
Manager
Staff
Customer
Vendor
Custom
```

Authorization should happen server-side.

---

# 28. Frontend Options

Support:

```text
React + Vite
Next.js
React Router
```

Primary PERN frontend:

```text
React + Vite + TypeScript
```

---

# 29. React

Generate:

```text
apps/web/src/

├── components/
├── features/
├── pages/
├── layouts/
├── hooks/
├── lib/
├── services/
├── stores/
├── types/
├── utils/
└── routes/
```

---

# 30. React Router

Support:

```text
React Router
```

Generate:

```text
routes/
├── index.tsx
├── protected.tsx
└── public.tsx
```

Support:

- Protected routes
- Guest routes
- Lazy loading
- Route metadata

---

# 31. State Management

Options:

```text
None
Zustand
Redux Toolkit
Jotai
```

Default:

```text
Zustand
```

Do not put server state into global state unnecessarily.

---

# 32. Server State

Options:

```text
TanStack Query
SWR
None
```

Recommended:

```text
TanStack Query
```

Generate:

```text
features/
services/
hooks/
```

---

# 33. UI

Options:

```text
Tailwind CSS
shadcn/ui
Material UI
Ant Design
Chakra UI
Headless UI
None
```

Recommended:

```text
Tailwind + shadcn/ui
```

Do not hard-code a design system if the user chooses another UI framework.

---

# 34. Forms

Options:

```text
React Hook Form
Formik
None
```

Recommended:

```text
React Hook Form
```

---

# 35. Frontend Validation

Options:

```text
Zod
Yup
Valibot
```

Recommended:

```text
Zod
```

Share schemas only if the monorepo architecture is selected and the generated contracts are safe to share.

---

# 36. Shared Types

Monorepo option:

```text
packages/
├── api-client/
├── types/
└── config/
```

Generate shared TypeScript types only when useful.

Never expose backend-only secrets or internal types.

---

# 37. API Client

Support:

```text
Fetch
Axios
TanStack Query
OpenAPI generated client
```

Recommended:

```text
Axios + TanStack Query
```

Generate:

```text
src/services/api.ts
src/services/auth.ts
src/features/
```

---

# 38. OpenAPI

Options:

```text
None
OpenAPI
Swagger UI
OpenAPI + TypeScript Client
```

Generate:

```text
docs/openapi.yaml
```

Optional:

```text
packages/api-client/
```

---

# 39. File Storage

Support:

```text
Local
AWS S3
Cloudflare R2
MinIO
```

Provider interface:

```ts
interface StorageProvider {
  upload(): Promise<string>;
  delete(): Promise<void>;
  getUrl(): Promise<string>;
}
```

---

# 40. Email

Support:

```text
SMTP
Resend
SendGrid
Amazon SES
Mailgun
Postmark
```

Development:

```text
Mailpit
```

Generate email service abstraction.

---

# 41. Notifications

Support:

```text
Email
Database
Push
SMS
Slack
```

Use an abstraction:

```text
NotificationService
```

---

# 42. Redis

Options:

```text
Disabled
Redis
```

Uses:

- Cache
- Rate limiting
- Sessions
- Queues
- Pub/Sub

Support:

```text
ioredis
```

---

# 43. Queue

Options:

```text
None
BullMQ
```

Generate:

```text
jobs/
workers/
queues/
```

Example:

```text
EmailQueue
NotificationQueue
PaymentQueue
```

---

# 44. WebSockets

Options:

```text
None
Socket.IO
ws
```

Support:

- Authentication
- Rooms
- Events
- Presence
- Notifications

Use Redis adapter when horizontally scaling Socket.IO.

---

# 45. Search

Options:

```text
None
PostgreSQL Full Text
Meilisearch
Elasticsearch
OpenSearch
```

Generate search abstraction.

---

# 46. Payments

Support:

```text
Stripe
PayPal
bKash
Nagad
SSLCommerz
Razorpay
```

Architecture:

```text
PaymentService
      ↓
PaymentGateway
      ↓
StripeAdapter
PayPalAdapter
BkashAdapter
```

Use:

```text
Strategy
Adapter
Factory
```

when multiple gateways are selected.

---

# 47. Stripe

Support:

- Payment Intents
- Checkout
- Refunds
- Subscriptions
- Webhooks
- Customer management

Webhook signatures must be verified.

Never trust payment status sent directly from the browser.

---

# 48. Multi-Tenancy

Options:

```text
None
Shared database
Database per tenant
```

Generate:

```text
Tenant
TenantResolver
TenantContext
TenantMiddleware
```

All tenant-scoped queries must enforce tenant isolation.

---

# 49. Admin Dashboard

Options:

```text
None
Custom React Admin
Refine
React Admin
```

Allow user to select.

Support:

- Dashboard
- Users
- Roles
- Permissions
- CRUD
- Charts
- Filters
- Search
- Tables
- Bulk actions

---

# 50. CRUD Generator

Command:

```bash
pern-starter make:crud Product
```

Ask:

```text
name:string|required
slug:string|required|unique
price:decimal|required
description:text
status:enum
categoryId:uuid|relation:Category
image:string
```

Generate:

```text
Database schema
Migration
Model
Repository
Service
Controller
Routes
Validation
DTO
Types
Tests
Frontend API
Frontend page
Frontend form
Frontend table
```

Only generate selected layers.

---

# 51. CRUD Field Mapping

```text
string
→ text input

text
→ textarea

integer
→ number

decimal
→ currency/number

boolean
→ switch

date
→ date picker

datetime
→ datetime picker

enum
→ select

uuid relation
→ relation select

file
→ upload

json
→ JSON editor
```

---

# 52. Module Generator

Command:

```bash
pern-starter make:module Product
```

Generate:

```text
modules/product/

controllers/
services/
repositories/
schemas/
routes/
types/
events/
jobs/
tests/
```

For DDD:

```text
domain/
application/
infrastructure/
presentation/
```

---

# 53. Generator Commands

Support:

```bash
make:controller
make:service
make:repository
make:usecase
make:dto
make:schema
make:middleware
make:policy
make:event
make:job
make:worker
make:hook
make:component
make:page
make:store
```

Generators must respect the selected architecture.

---

# 54. Database Seeding

Generate:

```text
prisma/seed.ts
```

or equivalent for selected ORM.

Support:

```text
Admin user
Roles
Permissions
Demo data
Development fixtures
```

Never generate production credentials.

---

# 55. Logging

Options:

```text
Pino
Winston
```

Recommended:

```text
Pino
```

Generate:

```text
logger.ts
request-id middleware
structured logging
```

Never log:

- Passwords
- Access tokens
- Refresh tokens
- Payment secrets
- API secrets

---

# 56. Monitoring

Support:

```text
Sentry
OpenTelemetry
Prometheus
Health checks
```

Health endpoints:

```text
/health
/ready
```

Check:

```text
Database
Redis
Queue
Storage
```

---

# 57. Security

Generate security middleware as appropriate:

```text
Helmet
CORS
Rate limiting
Request size limits
Input validation
Secure cookies
CSRF protection where cookie-based auth requires it
```

Support:

```text
express-rate-limit
helmet
cors
```

Do not blindly enable incompatible security middleware.

---

# 58. Error Handling

Central error middleware:

```text
AppError
ValidationError
AuthenticationError
AuthorizationError
NotFoundError
ConflictError
```

Response:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

Production errors must not expose stack traces.

---

# 59. Request Validation

Support:

```text
Zod
Joi
Yup
Valibot
```

Recommended:

```text
Zod
```

Example:

```text
Request
↓
Validation
↓
Controller
↓
Service
↓
Repository
↓
Database
```

---

# 60. Transactions

Generate transaction abstraction appropriate to the selected ORM.

For Prisma:

```ts
prisma.$transaction(...)
```

Use transactions for:

- Payment + order state changes
- Complex multi-table writes
- Inventory updates
- Financial operations

Avoid unnecessary transactions.

---

# 61. Concurrency / Inventory

For e-commerce modules:

- Use database constraints
- Transactions
- Atomic updates
- Row-level locking where supported/appropriate
- Idempotency keys
- Unique constraints

Never rely only on frontend validation.

---

# 62. Caching

Options:

```text
None
Redis
```

Support:

```text
Cache-aside
TTL
Invalidation
```

Do not cache personalized data without a correct cache key.

---

# 63. Docker

Options:

```text
None
Development
Development + Production
```

Services:

```text
api
web
postgres
redis
mailpit
minio
```

Only create selected services.

---

# 64. Docker Compose

Example:

```text
docker-compose.yml
docker-compose.dev.yml
docker-compose.prod.yml
```

Use health checks.

Do not hard-code production secrets.

---

# 65. Monorepo

Options:

```text
npm workspaces
pnpm workspaces
Turborepo
Nx
```

Recommended:

```text
pnpm workspaces + Turborepo
```

Structure:

```text
apps/
├── api/
└── web/

packages/
├── types/
├── config/
├── ui/
└── api-client/
```

Only create packages selected by configuration.

---

# 66. Testing

Backend:

```text
Vitest
Jest
Supertest
```

Recommended:

```text
Vitest + Supertest
```

Frontend:

```text
Vitest
React Testing Library
```

E2E:

```text
Playwright
Cypress
```

Recommended:

```text
Playwright
```

---

# 67. Test Layers

Generate:

```text
Unit tests
Integration tests
API tests
Component tests
E2E tests
```

CRUD tests:

```text
Create
Read
Update
Delete
Validation
Authentication
Authorization
```

---

# 68. Code Quality

Support:

```text
ESLint
Prettier
TypeScript
Husky
lint-staged
Commitlint
```

Optional:

```text
Biome
```

Do not configure overlapping formatters unless selected.

---

# 69. Environment Management

Generate:

```text
.env.example
.env.test.example
```

Validate environment variables at startup.

Use schema validation.

Example:

```text
DATABASE_URL
JWT_SECRET
JWT_REFRESH_SECRET
REDIS_URL
CORS_ORIGIN
```

Never commit:

```text
.env
```

---

# 70. Configuration

Structure:

```text
src/config/
├── app.ts
├── database.ts
├── auth.ts
├── redis.ts
├── storage.ts
├── mail.ts
├── payment.ts
└── index.ts
```

Configuration should be centralized.

Do not access `process.env` throughout business logic.

---

# 71. API Versioning

Default:

```text
/api/v1
```

Allow:

```text
/api/v2
```

Structure:

```text
routes/
├── v1/
└── v2/
```

---

# 72. Pagination

Support:

```text
Offset pagination
Cursor pagination
```

Default:

```text
Cursor pagination for large datasets
Offset pagination for simple admin tables
```

Response:

```json
{
  "data": [],
  "meta": {
    "nextCursor": null
  }
}
```

---

# 73. Filtering

Support:

```text
filter[field]
sort
page
limit
search
```

Validate all filter fields against allowed fields.

Never directly concatenate user-provided SQL.

---

# 74. File Upload Security

Support:

- File size limits
- MIME validation
- Extension validation
- Storage isolation
- Random filenames
- Virus scanning integration option

Never trust filename or MIME type from the client alone.

---

# 75. CI/CD

Support:

```text
GitHub Actions
GitLab CI
```

Pipeline:

```text
Install
Lint
Typecheck
Unit tests
Integration tests
Build
E2E
Docker build
```

Optional deployment:

```text
Railway
Render
Fly.io
AWS
DigitalOcean
Vercel
Cloudflare
```

Do not hard-code deployment provider assumptions.

---

# 76. Documentation

Generate:

```text
README.md
ARCHITECTURE.md
API.md
AUTH.md
DATABASE.md
DEPLOYMENT.md
DOCKER.md
TESTING.md
SECURITY.md
AI_CONTEXT.md
```

API documentation:

```text
docs/openapi.yaml
```

---

# 77. Cursor AI Rules

Generate:

```text
.cursor/
└── rules/
    ├── architecture.mdc
    ├── backend.mdc
    ├── frontend.mdc
    ├── database.mdc
    ├── security.mdc
    └── testing.mdc
```

Rules must describe the selected configuration.

Example:

```text
Business logic belongs in services/use-cases.

Controllers must remain thin.

Repositories must only be used when configured.

Validate all external input.

Do not access process.env outside config modules.

Do not bypass authorization.

Do not expose secrets.

Follow the generated architecture.

Add tests for business-critical changes.
```

---

# 78. Starter Manifest

Generate:

```text
starter.json
```

Example:

```json
{
  "version": 1,
  "stack": "PERN",
  "language": "typescript",
  "packageManager": "pnpm",
  "architecture": "modular-monolith",
  "backend": {
    "framework": "express",
    "api": "rest",
    "orm": "prisma"
  },
  "frontend": {
    "framework": "react",
    "bundler": "vite",
    "state": "zustand",
    "serverState": "tanstack-query",
    "validation": "zod"
  },
  "database": "postgresql",
  "cache": "redis",
  "auth": "jwt-refresh-token",
  "rbac": "custom",
  "docker": true,
  "payments": ["stripe"],
  "testing": ["vitest", "playwright"]
}
```

---

# 79. Feature Registry

Every feature must define:

```text
id
name
description
dependencies
conflicts
packages
environmentVariables
installer
generator
validator
templates
```

Example:

```ts
interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  conflicts: string[];
  packages: PackageDefinition[];
  installer: FeatureInstaller;
}
```

---

# 80. Installer Contract

```ts
interface FeatureInstaller {
  id(): string;

  supports(config: StarterConfig): boolean;

  validate(config: StarterConfig): ValidationResult;

  install(context: StarterContext): Promise<void>;

  remove(context: StarterContext): Promise<void>;
}
```

All installers must be independently testable.

---

# 81. Dependency Resolver

Before installation:

```text
Read configuration
↓
Resolve dependencies
↓
Resolve package versions
↓
Detect conflicts
↓
Validate Node version
↓
Validate package manager
↓
Validate architecture
↓
Generate installation plan
```

Example:

```text
You selected BullMQ.

Dependency:
Redis

Redis is currently disabled.

Add Redis automatically?

[Y/n]
```

Never silently install a major feature.

---

# 82. Idempotency

Running:

```bash
pern-starter install redis
```

twice must not duplicate:

- Packages
- Environment variables
- Docker services
- Config
- Routes
- Middleware

---

# 83. Overwrite Protection

If a generated file exists:

```text
File exists:

1. Skip
2. Replace
3. Merge
4. Cancel
```

Never silently overwrite application code.

---

# 84. Transactional Generation

Use temporary workspace:

```text
Collect configuration
↓
Validate
↓
Resolve dependencies
↓
Resolve conflicts
↓
Show plan
↓
Confirm
↓
Create workspace
↓
Install packages
↓
Generate backend
↓
Generate database
↓
Generate frontend
↓
Generate infrastructure
↓
Generate tests
↓
Generate docs
↓
Run validation
↓
Finalize
```

If generation fails:

- Clean temporary files
- Report error
- Do not claim success
- Preserve useful logs

---

# 85. Presets

## Basic PERN

```text
Express
TypeScript
React
Vite
PostgreSQL
Prisma
REST
Zod
Pino
Vitest
Playwright
ESLint
Prettier
```

## API Starter

```text
Express
TypeScript
PostgreSQL
Prisma
REST
JWT
RBAC
Zod
OpenAPI
Redis
BullMQ
Docker
Vitest
```

## SaaS

```text
Modular Monolith
Express
React
TypeScript
PostgreSQL
Prisma
JWT
RBAC
Redis
BullMQ
Stripe
S3
Email
Sentry
Docker
CI/CD
Playwright
```

## E-commerce

```text
Modular Monolith
React
TypeScript
Express
PostgreSQL
Prisma
JWT
RBAC
Redis
BullMQ
Stripe
bKash
Nagad
S3/R2
Search
Notifications
Audit Logs
Docker
```

## Enterprise

```text
DDD
Clean Architecture
Express
React
TypeScript
PostgreSQL
Prisma
OAuth
RBAC
Redis
BullMQ
OpenAPI
OpenTelemetry
Sentry
Docker
CI/CD
CQRS optional
```

---

# 86. Example CLI Experience

```text
╭──────────────────────────────────────────────╮
│              PERN STARTER                    │
│       Production Project Generator           │
╰──────────────────────────────────────────────╯

Project:
> marketplace

Language:
> TypeScript

Package Manager:
> pnpm

Architecture:
> Modular Monolith

Backend:
> Express

API:
> REST

ORM:
> Prisma

Database:
> PostgreSQL

Authentication:
> JWT + Refresh Token

RBAC:
> Custom

Frontend:
> React + Vite

State:
> Zustand

Server State:
> TanStack Query

Validation:
> Zod

UI:
> Tailwind + shadcn/ui

Cache:
> Redis

Queue:
> BullMQ

Storage:
> S3

Payments:
> Stripe + bKash

Email:
> Resend

Monitoring:
> Sentry

Testing:
> Vitest + Playwright

Docker:
> Yes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate this project?

> Yes
```

---

# 87. Success Output

```text
╭────────────────────────────────────────────╮
│          PROJECT CREATED                   │
╰────────────────────────────────────────────╯

Project:
marketplace

Backend:
apps/api

Frontend:
apps/web

Database:
PostgreSQL + Prisma

Authentication:
JWT + Refresh Token

RBAC:
Custom

Architecture:
Modular Monolith

Cache:
Redis

Queue:
BullMQ

Payments:
Stripe + bKash

Storage:
S3

Testing:
Vitest + Playwright

Docker:
Enabled

Next:

cd marketplace

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

pnpm install

docker compose up -d

pnpm db:migrate

pnpm dev
```

---

# 88. Generated Project Structure

Full-stack monorepo:

```text
project/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── controllers/
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── schemas/
│   │   │   ├── types/
│   │   │   ├── jobs/
│   │   │   ├── events/
│   │   │   ├── utils/
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── web/
│       ├── src/
│       │   ├── components/
│       │   ├── features/
│       │   ├── pages/
│       │   ├── layouts/
│       │   ├── hooks/
│       │   ├── services/
│       │   ├── stores/
│       │   ├── routes/
│       │   ├── types/
│       │   └── lib/
│       └── package.json
│
├── packages/
│   ├── types/
│   ├── api-client/
│   ├── ui/
│   └── config/
│
├── prisma/
├── docker/
├── docs/
├── .github/
├── .cursor/
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── starter.json
├── README.md
├── ARCHITECTURE.md
├── SECURITY.md
└── AI_CONTEXT.md
```

Only create directories that are actually selected.

---

# 89. Database Schema Generation

The generator should support:

```text
User
Role
Permission
Tenant
AuditLog
Session
RefreshToken
```

only when their associated features are selected.

For example:

```text
JWT authentication
→ RefreshToken

RBAC
→ Role
→ Permission

Multi-tenancy
→ Tenant
```

Do not generate unused tables.

---

# 90. API Authentication Flow

```text
Register
   ↓
Validate
   ↓
Hash Password
   ↓
Create User
   ↓
Issue Access Token
   ↓
Issue Refresh Token
```

Refresh:

```text
Refresh Token
   ↓
Validate
   ↓
Rotate
   ↓
Revoke old token
   ↓
Issue new tokens
```

Logout:

```text
Revoke refresh token
```

---

# 91. Frontend Authentication Flow

Support:

```text
Public Routes
Protected Routes
Guest Routes
Role Routes
Permission Routes
```

Example:

```text
/
 /login
 /register
 /dashboard
 /admin
```

Protect sensitive operations on the backend regardless of frontend route protection.

---

# 92. API Documentation

Generate:

```text
docs/openapi.yaml
```

Include:

- Authentication
- Users
- CRUD resources
- Error responses
- Pagination
- Filtering
- Examples

Optional Swagger UI:

```text
/api/docs
```

Protect or disable public API documentation in production when appropriate.

---

# 93. Health Checks

Generate:

```text
GET /health
GET /ready
```

Response:

```json
{
  "status": "ok",
  "services": {
    "database": "ok",
    "redis": "ok"
  }
}
```

Do not reveal credentials or internal infrastructure details.

---

# 94. Audit Logging

Optional feature.

Record:

```text
actor
action
resource
resourceId
metadata
ip
userAgent
timestamp
```

Never store sensitive credentials or tokens in audit metadata.

---

# 95. API Rate Limiting

Generate configurable limits:

```text
Auth:
5 requests/minute

General:
100 requests/minute

Sensitive:
10 requests/minute
```

Allow configuration per route.

Redis-backed rate limiting when Redis is enabled.

---

# 96. Search Architecture

For search providers:

```text
SearchService
      ↓
SearchProvider
      ↓
PostgresSearchProvider
MeilisearchProvider
ElasticProvider
```

Do not tightly couple business logic to a search engine.

---

# 97. Storage Architecture

```text
StorageService
      ↓
StorageProvider
      ↓
LocalProvider
S3Provider
R2Provider
MinioProvider
```

---

# 98. Email Architecture

```text
EmailService
      ↓
EmailProvider
      ↓
SMTP
Resend
SES
SendGrid
Postmark
```

---

# 99. Payment Architecture

```text
PaymentService
      ↓
PaymentGateway
      ↓
Stripe
PayPal
bKash
Nagad
SSLCommerz
Razorpay
```

Every gateway must support only the capabilities it actually provides.

---

# 100. Event Architecture

Optional:

```text
events/
listeners/
handlers/
```

Support:

```text
In-process events
Redis Pub/Sub
Message Queue
```

Events should be versionable when used across service boundaries.

---

# 101. Microservice Ready

Do not automatically generate microservices.

Instead generate:

```text
apps/
├── api
├── auth-service
├── payment-service
└── notification-service
```

only when explicitly selected.

Shared contracts:

```text
packages/contracts/
```

---

# 102. Deployment Profiles

Support:

```text
Local
Docker
Staging
Production
```

Generate environment templates:

```text
.env.example
.env.staging.example
.env.production.example
```

Never generate actual production secrets.

---

# 103. Production Checklist

The generator should provide:

```text
[ ] Environment variables configured
[ ] Database migrations applied
[ ] Authentication configured
[ ] Authorization configured
[ ] CORS configured
[ ] Rate limits configured
[ ] Logging enabled
[ ] Health checks enabled
[ ] Error monitoring configured
[ ] HTTPS configured
[ ] Database backups configured externally
[ ] Docker image builds
[ ] Tests passing
[ ] Frontend build passing
[ ] API documentation generated
```

---

# 104. Developer Experience

Commands should be fast, readable, and predictable.

Use clear terminal sections:

```text
✓ Configuration
✓ Dependencies
✓ Database
✓ Authentication
✓ Backend
✓ Frontend
✓ Infrastructure
✓ Testing
✓ Documentation
```

Failures:

```text
✗ Stripe configuration failed

Reason:
STRIPE_SECRET_KEY is missing.

Fix:
Add STRIPE_SECRET_KEY to .env.
```

Never show an unexplained stack trace as the only error message.

---

# 105. Builder Internal Architecture

Do not implement the generator as one giant class.

Use:

```text
src/
├── cli/
├── core/
│   ├── config/
│   ├── registry/
│   ├── dependency/
│   ├── conflict/
│   ├── planner/
│   └── context/
│
├── features/
│   ├── auth/
│   ├── database/
│   ├── redis/
│   ├── payments/
│   ├── storage/
│   └── monitoring/
│
├── architectures/
├── patterns/
├── generators/
├── templates/
├── installers/
├── validators/
└── utils/
```

Use dependency injection.

Use interfaces where abstraction is meaningful.

Prefer composition over giant inheritance hierarchies.

---

# 106. Feature Definition

Example:

```ts
interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  conflicts: string[];
  packages: PackageDefinition[];
  env: EnvDefinition[];
  installer: string;
  generator?: string;
}
```

---

# 107. Generator Contract

```ts
interface Generator {
  id(): string;

  supports(config: StarterConfig): boolean;

  validate(config: StarterConfig): ValidationResult;

  generate(context: GenerationContext): Promise<void>;
}
```

---

# 108. Template Engine

Support:

```text
Handlebars
EJS
Mustache
Custom AST templates
```

Use a consistent template system.

Templates must be versioned.

Example:

```text
templates/
├── backend/
├── frontend/
├── prisma/
├── docker/
├── testing/
└── docs/
```

---

# 109. AST-Based Code Modification

For existing projects, prefer AST-based modifications when possible.

Use AST tools for:

- Imports
- Route registration
- Middleware
- Configuration
- Exports

Avoid fragile string replacement.

---

# 110. Existing Project Support

Support:

```bash
pern-starter install auth
```

inside an existing generated project.

Before modifying:

```text
Detect stack
Detect architecture
Detect package manager
Read starter.json
Validate compatibility
Create backup/diff
Show plan
Ask confirmation
```

---

# 111. Diff Preview

Support:

```bash
pern-starter install stripe --dry-run
```

Output:

```text
Files to create:
+ src/payments/stripe.ts

Files to modify:
~ src/config/index.ts
~ .env.example
~ package.json

Packages:
+ stripe

Continue?
```

---

# 112. Migration Safety

Never automatically destroy production data.

Commands like:

```text
reset database
drop tables
remove feature
```

must require explicit confirmation.

---

# 113. Feature Removal

Example:

```bash
pern-starter remove redis
```

Before removal:

```text
Redis is used by:

- BullMQ
- Rate limiting
- Cache

Cannot safely remove Redis.

Remove dependent features first?
```

Dependency graph must prevent broken projects.

---

# 114. Doctor Command

```bash
pern-starter doctor
```

Check:

```text
Node
Package Manager
Docker
PostgreSQL
Redis
Environment
Dependencies
TypeScript
Database connection
Frontend build
Backend tests
```

Output:

```text
✓ Node
✓ pnpm
✓ PostgreSQL
✓ Redis
✗ Stripe environment variables
```

---

# 115. Testing the Builder

The builder itself must have tests for:

- Configuration parsing
- Dependency resolution
- Conflict detection
- Pattern selection
- Feature installation
- Template rendering
- CLI commands
- Dry-run
- Idempotency
- File overwrite handling
- Generated project compilation
- Generated API tests
- Generated frontend build

Use fixture projects.

---

# 116. Acceptance Criteria

The product is complete when:

- [ ] CLI works
- [ ] Interactive wizard works
- [ ] Non-interactive mode works
- [ ] YAML/JSON configuration works
- [ ] Dry-run works
- [ ] Feature registry works
- [ ] Dependency resolver works
- [ ] Conflict resolver works
- [ ] Pattern registry works
- [ ] Pattern recommendations work
- [ ] Express works
- [ ] TypeScript works
- [ ] PostgreSQL works
- [ ] Prisma works
- [ ] Drizzle works
- [ ] TypeORM works
- [ ] REST works
- [ ] GraphQL works
- [ ] JWT works
- [ ] Refresh-token rotation works
- [ ] OAuth works
- [ ] Social login works
- [ ] RBAC works
- [ ] React works
- [ ] Vite works
- [ ] React Router works
- [ ] Zustand works
- [ ] Redux Toolkit works
- [ ] TanStack Query works
- [ ] Zod works
- [ ] Tailwind works
- [ ] shadcn/ui works
- [ ] Redis works
- [ ] BullMQ works
- [ ] WebSockets work
- [ ] S3 works
- [ ] Cloudflare R2 works
- [ ] Email providers work
- [ ] Stripe works
- [ ] bKash works
- [ ] PayPal works
- [ ] Search integrations work
- [ ] Monitoring works
- [ ] Docker works
- [ ] CI/CD works
- [ ] CRUD generation works
- [ ] Module generation works
- [ ] Pattern generation works
- [ ] OpenAPI works
- [ ] Testing setup works
- [ ] Documentation generation works
- [ ] Cursor rules work
- [ ] starter.json works
- [ ] Existing project installation works
- [ ] Feature removal is dependency-aware
- [ ] Generated projects pass typecheck
- [ ] Generated projects pass tests
- [ ] Generated projects build successfully

---

# 117. Cursor Implementation Instructions

Build this as a real production-grade developer tool.

Do not create a demo.

Do not hard-code one project template.

Build a reusable generator engine.

Use:

- SOLID
- Dependency Injection
- Composition
- Registry pattern
- Strategy pattern
- Factory pattern
- Adapter pattern
- Command pattern
- Template Method where useful

Do not force design patterns into generated applications.

Do not install unused packages.

Do not generate unused folders.

Do not expose secrets.

Do not silently overwrite files.

Do not silently modify architecture.

Do not silently install major dependencies.

Always show the installation plan.

Always validate compatibility.

Always test generated projects.

Always generate documentation.

Always generate AI context based on the selected architecture.

The final product should feel like:

> Spring Initializr + modern Node scaffolding + Laravel-style generators + Filament-style resource generation + production-grade PERN architecture builder.

# END OF SPECIFICATION
