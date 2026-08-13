import type {
  GenerationContextLike,
  Generator,
  StarterConfig,
  ValidationResult,
} from '../../core/types.js';
import { emptyValidation } from '../../core/types.js';
import { addApiDeps, ctxPaths, fileName, isTs } from '../helpers.js';
import {
  DEV_ADMIN_EMAIL,
  DEV_ADMIN_PASSWORD,
  hasAuth,
  hasRefresh,
  hasSession,
  isTs as ts,
  prismaDir,
  relImport,
  t,
  typeImport,
  writeSrc,
} from './shared.js';

export class DatabaseGenerator implements Generator {
  id() {
    return 'backend-database';
  }

  supports(_config: StarterConfig) {
    return true;
  }

  validate(_config: StarterConfig): ValidationResult {
    return emptyValidation();
  }

  async generate(context: GenerationContextLike): Promise<void> {
    const c = context.config;
    if (c.docker !== 'none') context.addDockerService('postgres');

    switch (c.orm) {
      case 'prisma':
        generatePrisma(context);
        break;
      case 'drizzle':
        generateDrizzle(context);
        break;
      case 'typeorm':
        generateTypeorm(context);
        break;
      case 'sequelize':
        generateSequelize(context);
        break;
      case 'knex':
        generateKnex(context);
        break;
      case 'pg':
        generatePg(context);
        break;
      default:
        generatePrisma(context);
    }

    writeTransactions(context);
  }
}

function generatePrisma(ctx: GenerationContextLike): void {
  const c = ctx.config;
  addPrismaModels(ctx);
  writeSrc(ctx, `${prismaDir(ctx)}/schema.prisma`, buildSchemaFromContext(ctx));
  writePrismaClient(ctx);
  if (hasAuth(c)) writePrismaSeed(ctx);
}

function addPrismaModels(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const tenant = c.multiTenancy !== 'none';
  const rbac = c.rbac !== 'none';

  if (c.multiTenancy !== 'none') {
    ctx.addPrismaEnum(`enum TenantStatus {
  active
  suspended
}`);
    ctx.addPrismaModel(`model Tenant {
  id        String       @id @default(uuid())
  name      String
  slug      String       @unique
  status    TenantStatus @default(active)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  users     User[]
  ${c.auditLog ? 'auditLogs AuditLog[]' : ''}
}`);
  }

  if (hasAuth(c)) {
    const userRelations = [
      hasRefresh(c) ? 'refreshTokens RefreshToken[]' : '',
      hasSession(c) ? 'sessions      Session[]' : '',
      rbac ? 'userRoles     UserRole[]' : '',
      c.notifications.includes('database') ? 'notifications Notification[]' : '',
      c.auditLog ? 'auditLogs     AuditLog[]' : '',
      'passwordResets PasswordResetToken[]',
      'emailVerifications EmailVerificationToken[]',
    ]
      .filter(Boolean)
      .join('\n  ');

    ctx.addPrismaModel(`model User {
  id                  String    @id @default(uuid())
  email               String
  passwordHash        String?
  name                String?
  emailVerifiedAt     DateTime?
  failedLoginAttempts Int       @default(0)
  lockedUntil         DateTime?
  deletedAt           DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  ${tenant ? 'tenantId String?\n  tenant   Tenant? @relation(fields: [tenantId], references: [id])' : ''}
  ${userRelations}

  ${tenant ? '@@unique([tenantId, email])' : '@@unique([email])'}
  @@index([deletedAt])
}`);

    ctx.addPrismaModel(`model PasswordResetToken {
  id        String    @id @default(uuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}`);

    ctx.addPrismaModel(`model EmailVerificationToken {
  id        String    @id @default(uuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}`);
  }

  if (hasRefresh(c)) {
    ctx.addPrismaModel(`model RefreshToken {
  id           String    @id @default(uuid())
  userId       String
  tokenHash    String    @unique
  expiresAt    DateTime
  revokedAt    DateTime?
  replacedById String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}`);
  }

  if (hasSession(c)) {
    ctx.addPrismaModel(`model Session {
  id        String    @id @default(uuid())
  userId    String
  expiresAt DateTime
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}`);
  }

  if (rbac && hasAuth(c)) {
    ctx.addPrismaModel(`model Role {
  id          String           @id @default(uuid())
  name        String           @unique
  description String?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  userRoles   UserRole[]
  permissions RolePermission[]
}`);
    ctx.addPrismaModel(`model Permission {
  id          String           @id @default(uuid())
  key         String           @unique
  description String?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  roles       RolePermission[]
}`);
    ctx.addPrismaModel(`model UserRole {
  userId     String
  roleId     String
  assignedAt DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role       Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
}`);
    ctx.addPrismaModel(`model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
}`);
  }

  if (c.auditLog) {
    ctx.addPrismaModel(`model AuditLog {
  id        String   @id @default(uuid())
  actorId   String?
  action    String
  entity    String
  entityId  String?
  metadata  Json?
  ip        String?
  createdAt DateTime @default(now())
  actor     User?    @relation(fields: [actorId], references: [id], onDelete: SetNull)
  ${tenant ? 'tenantId String?\n  tenant   Tenant? @relation(fields: [tenantId], references: [id])' : ''}

  @@index([entity, entityId])
  @@index([createdAt])
}`);
  }

  if (c.notifications.includes('database')) {
    ctx.addPrismaModel(`model Notification {
  id        String    @id @default(uuid())
  userId    String
  channel   String
  title     String
  body      String
  readAt    DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt])
}`);
  }

  if (c.payments.length) {
    ctx.addPrismaEnum(`enum PaymentStatus {
  pending
  succeeded
  failed
  canceled
}`);
    ctx.addPrismaModel(`model Payment {
  id                    String        @id @default(uuid())
  provider              String
  providerPaymentId     String        @unique
  amount                Int
  currency              String
  status                PaymentStatus @default(pending)
  idempotencyKey        String        @unique
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  @@index([status])
}`);
  }
}

function buildSchemaFromContext(ctx: GenerationContextLike): string {
  const header = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`;
  return [header, ...ctx.prismaEnums, ...ctx.prismaModels].filter(Boolean).join('\n\n') + '\n';
}

function writePrismaClient(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('lib', 'db');
  writeSrc(
    ctx,
    file,
    `import { PrismaClient } from '@prisma/client';
import { databaseConfig } from '${relImport(file, p.apiFile('config', 'database'))}';
import { env } from '${relImport(file, p.apiFile('config', 'env'))}';

const globalForPrisma = globalThis${t(c, ' as { prisma?: PrismaClient }')};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: { db: { url: databaseConfig.url } },
});

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function pingDb() {
  try {
    await prisma.$queryRaw\`SELECT 1\`;
    return true;
  } catch {
    return false;
  }
}

export async function closeDb() {
  await prisma.$disconnect();
}
`,
  );
}

function writePrismaSeed(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const seedFile = `${prismaDir(ctx)}/${fileName(c, 'seed')}`;
  const hashPkg = c.passwordHash === 'bcrypt' ? 'bcryptjs' : 'argon2';
  const hashCall =
    c.passwordHash === 'bcrypt'
      ? `await bcrypt.hash('${DEV_ADMIN_PASSWORD}', 12)`
      : `await argon2.hash('${DEV_ADMIN_PASSWORD}', { type: argon2.argon2id })`;
  const hashImport =
    c.passwordHash === 'bcrypt' ? `import bcrypt from 'bcryptjs';` : `import argon2 from 'argon2';`;

  const rbac = c.rbac !== 'none';
  writeSrc(
    ctx,
    seedFile,
    `import { PrismaClient } from '@prisma/client';
${hashImport}

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed in production');
  }

  const passwordHash = ${hashCall};
${rbac ? seedRoles() : ''}
  const admin = await prisma.user.findFirst({ where: { email: DEV_EMAIL } }) ?? await prisma.user.create({
    data: {
      email: DEV_EMAIL,
      name: 'Local Admin',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
${rbac ? `  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });
` : ''}  console.info('Seeded development admin user', { email: DEV_EMAIL });
}

const DEV_EMAIL = '${DEV_ADMIN_EMAIL}';

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
`,
  );
  void hashPkg;
  ctx.addNote(
    `Development seed creates ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD}. This is a local placeholder — change it and never use it in production.`,
  );
}

function seedRoles(): string {
  return `  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin', description: 'Administrator' },
  });
  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: { name: 'user', description: 'Standard user' },
  });
  const keys = ['users:read', 'users:write', 'roles:write'];
  for (const key of keys) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permission.id },
    });
  }
  void userRole;
`;
}

function writeTransactions(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('lib', 'transaction');
  const dbFile = p.apiFile('lib', 'db');

  if (c.orm === 'prisma') {
    writeSrc(
      ctx,
      file,
      `${typeImport(c, `import type { Prisma } from '@prisma/client';\n`)}import { prisma } from '${relImport(file, dbFile)}';

export function withTransaction${t(c, '<T>')}(fn${t(c, ': (tx: Prisma.TransactionClient) => Promise<T>')})${t(c, ': Promise<T>')} {
  return prisma.$transaction((tx) => fn(tx));
}
`,
    );
    return;
  }

  if (c.orm === 'drizzle') {
    writeSrc(
      ctx,
      file,
      `import { db } from '${relImport(file, dbFile)}';

export function withTransaction${t(c, '<T>')}(fn${t(c, ': (tx: typeof db) => Promise<T>')})${t(c, ': Promise<T>')} {
  return db.transaction((tx) => fn(tx));
}
`,
    );
    return;
  }

  writeSrc(
    ctx,
    file,
    `export async function withTransaction${t(c, '<T>')}(fn${t(c, ': () => Promise<T>')})${t(c, ': Promise<T>')} {
  return fn();
}
`,
  );
}

function generateDrizzle(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  addApiDeps(ctx, [['postgres', '^3.4.5']]);
  const schemaFile = p.apiSrc(`db/${fileName(c, 'schema')}`);
  const clientFile = p.apiFile('lib', 'db');
  const configFile = p.apiRoot === '.' ? 'drizzle.config.ts' : `${p.apiRoot}/drizzle.config.ts`;

  writeSrc(ctx, schemaFile, drizzleSchema(c));
  writeSrc(
    ctx,
    clientFile,
    `import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { databaseConfig } from '${relImport(clientFile, p.apiFile('config', 'database'))}';
import * as schema from '${relImport(clientFile, schemaFile)}';

const client = postgres(databaseConfig.url);
export const db = drizzle(client, { schema });

export async function pingDb() {
  try {
    await client\`SELECT 1\`;
    return true;
  } catch {
    return false;
  }
}

export async function closeDb() {
  await client.end();
}
`,
  );
  writeSrc(
    ctx,
    isTs(c) ? configFile : configFile.replace('.ts', '.js'),
    `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.${isTs(c) ? 'ts' : 'js'}',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
`,
  );
}

function drizzleSchema(c: StarterConfig): string {
  const parts = [
    `import { pgTable, text, timestamp, integer, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';`,
  ];
  if (c.multiTenancy !== 'none') {
    parts.push(`export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});`);
  }
  if (hasAuth(c)) {
    parts.push(`export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  name: text('name'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
${c.multiTenancy !== 'none' ? '  tenantId: text(\'tenant_id\'),' : ''}
}, (table) => ({ emailIdx: uniqueIndex('users_email_idx').on(${c.multiTenancy !== 'none' ? 'table.tenantId, table.email' : 'table.email'}) }));`);
  }
  if (hasRefresh(c)) {
    parts.push(`export const refreshTokens = pgTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  replacedById: text('replaced_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});`);
  }
  return `${parts.join('\n\n')}\n`;
}

function generateTypeorm(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  addApiDeps(ctx, [
    ['pg', '^8.14.1'],
    ['reflect-metadata', '^0.2.2'],
  ]);
  const dsFile = p.apiSrc(`db/${fileName(c, 'data-source')}`);
  const userFile = p.apiSrc(`db/entities/${fileName(c, 'user.entity')}`);
  const clientFile = p.apiFile('lib', 'db');

  writeSrc(
    ctx,
    dsFile,
    `import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseConfig } from '${relImport(dsFile, p.apiFile('config', 'database'))}';
${hasAuth(c) ? `import { UserEntity } from '${relImport(dsFile, userFile)}';` : ''}

export const dataSource = new DataSource({
  type: 'postgres',
  url: databaseConfig.url,
  entities: [${hasAuth(c) ? 'UserEntity' : ''}],
  synchronize: false,
  logging: false,
});
`,
  );

  if (hasAuth(c)) {
    writeSrc(
      ctx,
      userFile,
      `import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id${t(c, '!: string')};

  @Column({ unique: true })
  email${t(c, '!: string')};

  @Column({ type: 'text', nullable: true })
  passwordHash${t(c, '?: string | null')};

  @Column({ type: 'text', nullable: true })
  name${t(c, '?: string | null')};

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt${t(c, '?: Date | null')};

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts${t(c, '!: number')};

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil${t(c, '?: Date | null')};

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt${t(c, '?: Date | null')};

  @CreateDateColumn()
  createdAt${t(c, '!: Date')};

  @UpdateDateColumn()
  updatedAt${t(c, '!: Date')};
}
`,
    );
  }

  writeSrc(
    ctx,
    clientFile,
    `import { dataSource } from '${relImport(clientFile, dsFile)}';

export { dataSource };

export async function pingDb() {
  try {
    if (!dataSource.isInitialized) await dataSource.initialize();
    await dataSource.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closeDb() {
  if (dataSource.isInitialized) await dataSource.destroy();
}
`,
  );
}

function generateSequelize(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  addApiDeps(ctx, [['pg', '^8.14.1']]);
  const seqFile = p.apiSrc(`db/${fileName(c, 'sequelize')}`);
  const userFile = p.apiSrc(`db/models/${fileName(c, 'user')}`);
  const clientFile = p.apiFile('lib', 'db');

  writeSrc(
    ctx,
    seqFile,
    `import { Sequelize } from 'sequelize';
import { databaseConfig } from '${relImport(seqFile, p.apiFile('config', 'database'))}';

export const sequelize = new Sequelize(databaseConfig.url, {
  dialect: 'postgres',
  logging: false,
});
`,
  );

  if (hasAuth(c)) {
    const userFields = ts(c)
      ? `{
  declare id: string;
  declare email: string;
  declare passwordHash: string | null;
  declare name: string | null;
  declare emailVerifiedAt: Date | null;
  declare failedLoginAttempts: number;
  declare lockedUntil: Date | null;
  declare deletedAt: Date | null;
}`
      : '';
    writeSrc(
      ctx,
      userFile,
      `import { DataTypes, Model } from 'sequelize';
import { sequelize } from '${relImport(userFile, seqFile)}';

export class UserModel extends Model ${userFields} {}

UserModel.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    passwordHash: { type: DataTypes.TEXT, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: true },
    emailVerifiedAt: { type: DataTypes.DATE, allowNull: true },
    failedLoginAttempts: { type: DataTypes.INTEGER, defaultValue: 0 },
    lockedUntil: { type: DataTypes.DATE, allowNull: true },
    deletedAt: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'users', underscored: true },
);
`,
    );
  }

  writeSrc(
    ctx,
    clientFile,
    `import { sequelize } from '${relImport(clientFile, seqFile)}';

export { sequelize };

export async function pingDb() {
  try {
    await sequelize.authenticate();
    return true;
  } catch {
    return false;
  }
}

export async function closeDb() {
  await sequelize.close();
}
`,
  );
}

function generateKnex(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  addApiDeps(ctx, [['pg', '^8.14.1']]);
  const knexfile = p.apiRoot === '.' ? fileName(c, 'knexfile') : `${p.apiRoot}/${fileName(c, 'knexfile')}`;
  const clientFile = p.apiFile('lib', 'db');
  const migration = `${p.apiRoot === '.' ? '' : `${p.apiRoot}/`}migrations/001_users.${isTs(c) ? 'ts' : 'js'}`;

  writeSrc(
    ctx,
    knexfile,
    `const config = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: { directory: './migrations' },
};

export default config;
`,
  );

  writeSrc(
    ctx,
    migration,
    `export async function up(knex) {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary();
    table.text('email').notNullable().unique();
    table.text('password_hash');
    table.text('name');
    table.timestamp('email_verified_at', { useTz: true });
    table.integer('failed_login_attempts').notNullable().defaultTo(0);
    table.timestamp('locked_until', { useTz: true });
    table.timestamp('deleted_at', { useTz: true });
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('users');
}
`,
  );

  writeSrc(
    ctx,
    clientFile,
    `import knex from 'knex';
import { databaseConfig } from '${relImport(clientFile, p.apiFile('config', 'database'))}';

export const db = knex({ client: 'pg', connection: databaseConfig.url });

export async function pingDb() {
  try {
    await db.raw('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closeDb() {
  await db.destroy();
}
`,
  );
}

function generatePg(ctx: GenerationContextLike): void {
  const p = ctxPaths(ctx);
  const clientFile = p.apiFile('lib', 'db');
  writeSrc(
    ctx,
    clientFile,
    `import pg from 'pg';
import { databaseConfig } from '${relImport(clientFile, p.apiFile('config', 'database'))}';

export const pool = new pg.Pool({ connectionString: databaseConfig.url });

export async function pingDb() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closeDb() {
  await pool.end();
}
`,
  );
}
