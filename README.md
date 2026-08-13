# pern-starter

Production-ready PERN project generator. Select the features you need; the CLI generates only those pieces.

PostgreSQL + Express + React + Node.js. TypeScript by default. Spring Initializr-style configuration with Laravel-style `make:*` generators.

## Install

```bash
npm install -g pern-starter
# or
pnpm add -g pern-starter
```

From this repo:

```bash
pnpm install
pnpm build
pnpm link --global
```

## Create a project

Interactive:

```bash
pern-starter new my-app
```

Non-interactive:

```bash
pern-starter new ecommerce \
  --orm=prisma \
  --auth=jwt-refresh-token \
  --frontend=vite-react \
  --architecture=modular-monolith \
  --rbac=custom \
  --docker \
  --redis
```

Presets: `basic`, `api`, `saas`, `ecommerce`, `enterprise`.

```bash
pern-starter new marketplace --preset=saas --yes
```

Config file:

```bash
pern-starter new ecommerce --config=starter.yaml
```

Dry run (no files written):

```bash
pern-starter new ecommerce --dry-run --yes
```

## Commands

```text
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

## How generation works

1. Read CLI flags, wizard answers, or YAML/JSON.
2. Resolve feature dependencies and conflicts.
3. Show an installation plan.
4. Generate into a temporary workspace.
5. Write backend, database, frontend, infrastructure, tests, docs, and `.agents` markdown plus skills.
6. Move the result into the destination folder.

Major dependencies are never added silently. BullMQ without Redis, for example, prompts before Redis is enabled.

Existing application files are never overwritten unless you pass `--force`.

## Defaults

| Choice | Default |
| --- | --- |
| Language | TypeScript (strict) |
| Package manager | pnpm |
| Architecture | Modular monolith |
| API | Express REST `/api/v1` |
| ORM | Prisma |
| Auth | JWT + rotating refresh tokens (HttpOnly cookies) |
| Password hashing | Argon2id |
| Validation | Zod |
| Logging | Pino |
| Frontend | React + Vite |
| UI | Tailwind + shadcn-style primitives |
| Client state | Zustand |
| Server state | TanStack Query |

## Vite UI (Vercel + local files)

The configurator is a separate Vite app in `web/`. Host it on Vercel. Generation does **not** write to the server. Chrome/Edge can save a folder on your computer; otherwise you download a zip.

```bash
npm run dev
```

Open http://localhost:5173 — name the project, open **Options** for stack details, then **Save to this computer**.

Deploy:

```bash
npx vercel
```

Root settings: build `npm run build:web`, output `dist/web`, API from `/api`.

CLI remains available with `npm run dev:cli -- new my-app`.
