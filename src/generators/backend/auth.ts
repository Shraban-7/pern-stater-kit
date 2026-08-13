import type {
  GenerationContextLike,
  Generator,
  StarterConfig,
  ValidationResult,
} from '../../core/types.js';
import { emptyValidation } from '../../core/types.js';
import { addApiDeps, ctxPaths, fileName, isTs } from '../helpers.js';
import {
  ACCESS_TOKEN_TTL,
  apiMod,
  hasAuth,
  hasJwt,
  hasOAuth,
  hasRefresh,
  hasSession,
  httpTypes,
  interfaceBlock,
  isExpress,
  isFastify,
  params,
  relImport,
  t,
  typeImport,
  validationImport,
  writeSrc,
} from './shared.js';

export class AuthGenerator implements Generator {
  id() {
    return 'backend-auth';
  }

  supports(config: StarterConfig) {
    return hasAuth(config);
  }

  validate(_config: StarterConfig): ValidationResult {
    return emptyValidation();
  }

  async generate(context: GenerationContextLike): Promise<void> {
    addAuthPackages(context);
    writePassword(context);
    writeTokens(context);
    writeCookies(context);
    writeAuthRepository(context);
    writeAuthService(context);
    writeAuthSchemas(context);
    writeAuthController(context);
    writeAuthRoutes(context);
    writeAuthMiddleware(context);
    if (context.config.rbac !== 'none') writeRbac(context);
    if (hasOAuth(context.config)) writeOAuth(context);
    if (hasSession(context.config)) writeSession(context);
  }
}

function addAuthPackages(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const deps: Array<[string, string, boolean?]> = [];
  if (hasJwt(c) || hasOAuth(c)) {
    deps.push(['jsonwebtoken', '^9.0.2']);
    if (isTs(c)) deps.push(['@types/jsonwebtoken', '^9.0.9', true]);
  }
  deps.push(c.passwordHash === 'bcrypt' ? ['bcryptjs', '^3.0.2'] : ['argon2', '^0.41.1']);
  if (hasSession(c)) {
    deps.push(['express-session', '^1.18.1']);
    if (isTs(c)) deps.push(['@types/express-session', '^1.18.1', true]);
    if (c.cache === 'redis') deps.push(['connect-redis', '^8.0.2']);
  }
  addApiDeps(ctx, deps);
}

function writePassword(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const file = ctxPaths(ctx).apiFile('lib', 'password');
  writeSrc(
    ctx,
    file,
    c.passwordHash === 'bcrypt'
      ? `import bcrypt from 'bcryptjs';
export async function hashPassword(password${t(c, ': string')}) { return bcrypt.hash(password, 12); }
export async function verifyPassword(hash${t(c, ': string')}, password${t(c, ': string')}) { return bcrypt.compare(password, hash); }
`
      : `import argon2 from 'argon2';
export async function hashPassword(password${t(c, ': string')}) { return argon2.hash(password, { type: argon2.argon2id }); }
export async function verifyPassword(hash${t(c, ': string')}, password${t(c, ': string')}) { return argon2.verify(hash, password); }
`,
  );
}

function writeTokens(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('lib', 'tokens');
  const jwtBlock =
    hasJwt(c) || hasOAuth(c)
      ? `import jwt from 'jsonwebtoken';
import { authConfig } from '${relImport(file, p.apiFile('config', 'auth'))}';
${interfaceBlock(c, `export interface AccessClaims { sub: string; email: string; roles?: string[]; tenantId?: string; }\n`)}
export function signAccessToken(payload${t(c, ': AccessClaims')}) {
  return jwt.sign(payload, authConfig.jwtSecret, { expiresIn: authConfig.accessTtl ?? '${ACCESS_TOKEN_TTL}' });
}
export function verifyAccessToken(token${t(c, ': string')}) {
  return jwt.verify(token, authConfig.jwtSecret)${t(c, ' as AccessClaims & jwt.JwtPayload')};
}
`
      : '';
  writeSrc(
    ctx,
    file,
    `import { createHash, randomBytes } from 'node:crypto';
${jwtBlock}
export function randomToken() { return randomBytes(48).toString('base64url'); }
export function hashToken(raw${t(c, ': string')}) { return createHash('sha256').update(raw).digest('hex'); }
`,
  );
}

function writeCookies(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('lib', 'cookies');
  const authCfg = relImport(file, p.apiFile('config', 'auth'));
  const http = httpTypes(c);
  if (isFastify(c)) {
    writeSrc(
      ctx,
      file,
      `${http.importLine}import { authConfig } from '${authCfg}';
export function setAuthCookies(reply${t(c, ': FastifyReply')}, tokens${t(c, ': { accessToken?: string; refreshToken?: string }')}) {
  const base = { httpOnly: true, secure: authConfig.cookieSecure, sameSite: 'lax', path: '/' };
  if (tokens.accessToken) reply.setCookie(authConfig.accessCookie, tokens.accessToken, { ...base, maxAge: 15 * 60 });
  if (tokens.refreshToken) reply.setCookie(authConfig.refreshCookie, tokens.refreshToken, { ...base, maxAge: 7 * 24 * 60 * 60 });
}
export function clearAuthCookies(reply${t(c, ': FastifyReply')}) {
  reply.clearCookie(authConfig.accessCookie, { path: '/' });
  reply.clearCookie(authConfig.refreshCookie, { path: '/' });
}
export function readRefreshCookie(request${t(c, ': FastifyRequest')}) { return request.cookies?.[authConfig.refreshCookie]; }
`,
    );
    return;
  }
  writeSrc(
    ctx,
    file,
    `${http.importLine}import { authConfig } from '${authCfg}';
export function setAuthCookies(res${t(c, ': Response')}, tokens${t(c, ': { accessToken?: string; refreshToken?: string }')}) {
  const base = { httpOnly: true, secure: authConfig.cookieSecure, sameSite: 'lax'${t(c, ' as const')}, path: '/' };
  if (tokens.accessToken) res.cookie(authConfig.accessCookie, tokens.accessToken, { ...base, maxAge: 15 * 60 * 1000 });
  if (tokens.refreshToken) res.cookie(authConfig.refreshCookie, tokens.refreshToken, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });
}
export function clearAuthCookies(res${t(c, ': Response')}) {
  res.clearCookie(authConfig.accessCookie, { path: '/' });
  res.clearCookie(authConfig.refreshCookie, { path: '/' });
}
export function readRefreshCookie(req${t(c, ': Request')}) { return req.cookies?.[authConfig.refreshCookie]; }
`,
    );
}

function writeAuthRepository(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('repositories', 'user.repository', apiMod(c, 'auth'));
  const dbFile = p.apiFile('lib', 'db');
  if (c.orm !== 'prisma') {
    writeSrc(ctx, file, nonPrismaRepo(c, relImport(file, dbFile)));
    return;
  }
  const roles =
    c.rbac !== 'none'
      ? `userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },`
      : '';
  writeSrc(
    ctx,
    file,
    `import { prisma } from '${relImport(file, dbFile)}';
const notDeleted = { deletedAt: null };
export class UserRepository {
  findByEmail(email${t(c, ': string')}) { return prisma.user.findFirst({ where: { email, ...notDeleted }, include: { ${roles} } }); }
  findById(id${t(c, ': string')}) { return prisma.user.findFirst({ where: { id, ...notDeleted }, include: { ${roles} } }); }
  create(data${t(c, ': { email: string; passwordHash: string; name?: string }')}) { return prisma.user.create({ data }); }
  update(id${t(c, ': string')}, data${t(c, ': Record<string, unknown>')}) { return prisma.user.update({ where: { id }, data }); }
  softDelete(id${t(c, ': string')}) { return prisma.user.update({ where: { id }, data: { deletedAt: new Date() } }); }
  list(skip${t(c, ': number')}, take${t(c, ': number')}) {
    return prisma.user.findMany({ where: notDeleted, skip, take, orderBy: { createdAt: 'desc' }, select: { id: true, email: true, name: true, createdAt: true, emailVerifiedAt: true } });
  }
  count() { return prisma.user.count({ where: notDeleted }); }
}
${hasRefresh(c) ? `export class RefreshTokenRepository {
  create(data${t(c, ': { userId: string; tokenHash: string; expiresAt: Date }')}) { return prisma.refreshToken.create({ data }); }
  findActive(tokenHash${t(c, ': string')}) { return prisma.refreshToken.findFirst({ where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } } }); }
  rotate(oldId${t(c, ': string')}, next${t(c, ': { userId: string; tokenHash: string; expiresAt: Date }')}) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({ data: next });
      await tx.refreshToken.update({ where: { id: oldId }, data: { revokedAt: new Date(), replacedById: created.id } });
      return created;
    });
  }
  revoke(tokenHash${t(c, ': string')}) { return prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } }); }
  revokeAllForUser(userId${t(c, ': string')}) { return prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }); }
}
` : ''}
export class PasswordResetRepository {
  create(data${t(c, ': { userId: string; tokenHash: string; expiresAt: Date }')}) { return prisma.passwordResetToken.create({ data }); }
  findActive(tokenHash${t(c, ': string')}) { return prisma.passwordResetToken.findFirst({ where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } } }); }
  markUsed(id${t(c, ': string')}) { return prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } }); }
}
export class EmailVerificationRepository {
  create(data${t(c, ': { userId: string; tokenHash: string; expiresAt: Date }')}) { return prisma.emailVerificationToken.create({ data }); }
  findActive(tokenHash${t(c, ': string')}) { return prisma.emailVerificationToken.findFirst({ where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } } }); }
  markUsed(id${t(c, ': string')}) { return prisma.emailVerificationToken.update({ where: { id }, data: { usedAt: new Date() } }); }
}
`,
  );
}

function nonPrismaRepo(c: StarterConfig, dbImport: string): string {
  if (c.orm === 'drizzle') {
    return `import { db } from '${dbImport}';
import { eq } from 'drizzle-orm';
import { users } from '${dbImport.replace(/lib\/db\.js$/, 'db/schema.js')}';
export class UserRepository {
  async findByEmail(email${t(c, ': string')}) { const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1); return row && !row.deletedAt ? row : null; }
  async findById(id${t(c, ': string')}) { const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1); return row && !row.deletedAt ? row : null; }
  async create(data${t(c, ': { email: string; passwordHash: string; name?: string }')}) { const [row] = await db.insert(users).values({ id: crypto.randomUUID(), email: data.email, passwordHash: data.passwordHash, name: data.name, failedLoginAttempts: 0 }).returning(); return row; }
  async update(id${t(c, ': string')}, data${t(c, ': Record<string, unknown>')}) { const [row] = await db.update(users).set(data).where(eq(users.id, id)).returning(); return row; }
  async list(skip${t(c, ': number')} = 0, take${t(c, ': number')} = 20) { return db.select().from(users).limit(take).offset(skip); }
  async count() { const rows = await db.select().from(users); return rows.length; }
  async softDelete(id${t(c, ': string')}) { return this.update(id, { deletedAt: new Date() }); }
}
export class RefreshTokenRepository { async create() { return null; } async findActive() { return null; } async rotate() { return null; } async revoke() {} async revokeAllForUser() {} }
export class PasswordResetRepository { async create() { return null; } async findActive() { return null; } async markUsed() {} }
export class EmailVerificationRepository { async create() { return null; } async findActive() { return null; } async markUsed() {} }
`;
  }
  if (c.orm === 'knex') {
    return `import { db } from '${dbImport}';
export class UserRepository {
  findByEmail(email${t(c, ': string')}) { return db('users').where({ email }).whereNull('deleted_at').first(); }
  findById(id${t(c, ': string')}) { return db('users').where({ id }).whereNull('deleted_at').first(); }
  async create(data${t(c, ': { email: string; passwordHash: string; name?: string }')}) { const id = crypto.randomUUID(); await db('users').insert({ id, email: data.email, password_hash: data.passwordHash, name: data.name }); return this.findById(id); }
  async update(id${t(c, ': string')}, data${t(c, ': Record<string, unknown>')}) { await db('users').where({ id }).update(data); return this.findById(id); }
  list(skip${t(c, ': number')} = 0, take${t(c, ': number')} = 20) { return db('users').whereNull('deleted_at').offset(skip).limit(take); }
  async count() { const row = await db('users').whereNull('deleted_at').count({ count: '*' }).first(); return Number(row?.count ?? 0); }
  async softDelete(id${t(c, ': string')}) { return this.update(id, { deleted_at: new Date() }); }
}
export class RefreshTokenRepository { async create() { return null; } async findActive() { return null; } async rotate() { return null; } async revoke() {} async revokeAllForUser() {} }
export class PasswordResetRepository { async create() { return null; } async findActive() { return null; } async markUsed() {} }
export class EmailVerificationRepository { async create() { return null; } async findActive() { return null; } async markUsed() {} }
`;
  }
  if (c.orm === 'pg') {
    return `import { pool } from '${dbImport}';
export class UserRepository {
  async findByEmail(email${t(c, ': string')}) { const r = await pool.query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1', [email]); return r.rows[0] ?? null; }
  async findById(id${t(c, ': string')}) { const r = await pool.query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [id]); return r.rows[0] ?? null; }
  async create(data${t(c, ': { email: string; passwordHash: string; name?: string }')}) {
    const id = crypto.randomUUID();
    const r = await pool.query('INSERT INTO users (id, email, password_hash, name) VALUES ($1,$2,$3,$4) RETURNING *', [id, data.email, data.passwordHash, data.name ?? null]);
    return r.rows[0];
  }
  async update(id${t(c, ': string')}, data${t(c, ': Record<string, unknown>')}) { await pool.query('UPDATE users SET name = COALESCE($2, name), password_hash = COALESCE($3, password_hash), failed_login_attempts = COALESCE($4, failed_login_attempts), locked_until = $5 WHERE id = $1', [id, data.name, data.passwordHash, data.failedLoginAttempts, data.lockedUntil ?? null]); return this.findById(id); }
  async list(skip${t(c, ': number')} = 0, take${t(c, ': number')} = 20) { const r = await pool.query('SELECT id, email, name, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC OFFSET $1 LIMIT $2', [skip, take]); return r.rows; }
  async count() { const r = await pool.query('SELECT COUNT(*)::int AS count FROM users WHERE deleted_at IS NULL'); return r.rows[0]?.count ?? 0; }
  async softDelete(id${t(c, ': string')}) { await pool.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [id]); return this.findById(id); }
}
export class RefreshTokenRepository { async create() { return null; } async findActive() { return null; } async rotate() { return null; } async revoke() {} async revokeAllForUser() {} }
export class PasswordResetRepository { async create() { return null; } async findActive() { return null; } async markUsed() {} }
export class EmailVerificationRepository { async create() { return null; } async findActive() { return null; } async markUsed() {} }
`;
  }
  return `import { ${c.orm === 'sequelize' ? 'sequelize' : 'dataSource'} } from '${dbImport}';
export class UserRepository {
  async findByEmail(email${t(c, ': string')}) { return { id: '0', email, passwordHash: null }; }
  async findById(id${t(c, ': string')}) { return { id, email: '', passwordHash: null }; }
  async create(data${t(c, ': { email: string; passwordHash: string; name?: string }')}) { return { id: crypto.randomUUID(), ...data }; }
  async update(id${t(c, ': string')}) { return this.findById(id); }
  async list() { return []; }
  async count() { return 0; }
  async softDelete(id${t(c, ': string')}) { return this.findById(id); }
}
export class RefreshTokenRepository { async create() { return null; } async findActive() { return null; } async rotate() { return null; } async revoke() {} async revokeAllForUser() {} }
export class PasswordResetRepository { async create() { return null; } async findActive() { return null; } async markUsed() {} }
export class EmailVerificationRepository { async create() { return null; } async findActive() { return null; } async markUsed() {} }
`;
}

function writeAuthService(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('services', 'auth.service', apiMod(c, 'auth'));
  const jwt = hasJwt(c) || hasOAuth(c);
  writeSrc(
    ctx,
    file,
    `import { AuthenticationError, ConflictError, NotFoundError, ValidationError } from '${relImport(file, p.apiFile('errors', 'index'))}';
import { hashPassword, verifyPassword } from '${relImport(file, p.apiFile('lib', 'password'))}';
import { hashToken, randomToken${jwt ? ', signAccessToken' : ''} } from '${relImport(file, p.apiFile('lib', 'tokens'))}';
import { authConfig } from '${relImport(file, p.apiFile('config', 'auth'))}';
import { env } from '${relImport(file, p.apiFile('config', 'env'))}';
import { UserRepository${hasRefresh(c) ? ', RefreshTokenRepository' : ''}, PasswordResetRepository, EmailVerificationRepository } from '${relImport(file, p.apiFile('repositories', 'user.repository', apiMod(c, 'auth')))}';

const users = new UserRepository();
${hasRefresh(c) ? 'const refreshTokens = new RefreshTokenRepository();' : ''}
const passwordResets = new PasswordResetRepository();
const emailVerifications = new EmailVerificationRepository();

function publicUser(user${t(c, ': { id: string; email: string; name?: string | null; emailVerifiedAt?: Date | null }')}) {
  return { id: user.id, email: user.email, name: user.name ?? null, emailVerifiedAt: user.emailVerifiedAt ?? null };
}
function rolesOf(user${t(c, ': { userRoles?: Array<{ role: { name: string } }> }')}) {
  return (user.userRoles ?? []).map((item) => item.role.name);
}
${jwt ? `function issueAccess(user${t(c, ': { id: string; email: string } & Record<string, unknown>')}) { return signAccessToken({ sub: user.id, email: user.email, roles: rolesOf(user) }); }` : ''}
${hasRefresh(c) ? `async function issueRefresh(userId${t(c, ': string')}) {
  const raw = randomToken();
  await refreshTokens.create({ userId, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
  return raw;
}` : ''}
function tokensFor(user${t(c, ': { id: string; email: string } & Record<string, unknown>')}) {
  return { user: publicUser(user)${jwt ? ', accessToken: issueAccess(user)' : ''} };
}

export class AuthService {
  async register(input${t(c, ': { email: string; password: string; name?: string }')}) {
    const email = input.email.trim().toLowerCase();
    if (await users.findByEmail(email)) throw new ConflictError('Email already registered');
    const user = await users.create({ email, passwordHash: await hashPassword(input.password), name: input.name });
    await emailVerifications.create({ userId: user.id, tokenHash: hashToken(randomToken()), expiresAt: new Date(Date.now() + 86400000) });
    return { ...tokensFor(user)${hasRefresh(c) ? ', refreshToken: await issueRefresh(user.id)' : ''} };
  }
  async login(input${t(c, ': { email: string; password: string }')}) {
    const user = await users.findByEmail(input.email.trim().toLowerCase());
    if (!user?.passwordHash) throw new AuthenticationError('Invalid credentials');
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) throw new AuthenticationError('Account locked. Try again later.');
    if (!(await verifyPassword(user.passwordHash, input.password))) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1;
      await users.update(user.id, { failedLoginAttempts: attempts, lockedUntil: attempts >= authConfig.lockoutAttempts ? new Date(Date.now() + authConfig.lockoutMinutes * 60000) : null });
      throw new AuthenticationError('Invalid credentials');
    }
    await users.update(user.id, { failedLoginAttempts: 0, lockedUntil: null });
    return { ...tokensFor(user)${hasRefresh(c) ? ', refreshToken: await issueRefresh(user.id)' : ''} };
  }
  async logout(refreshRaw${t(c, '?: string')}) { ${hasRefresh(c) ? 'if (refreshRaw) await refreshTokens.revoke(hashToken(refreshRaw));' : ''} }
  ${hasRefresh(c) ? `async refresh(refreshRaw${t(c, '?: string')}) {
    if (!refreshRaw) throw new AuthenticationError('Refresh token required');
    const current = await refreshTokens.findActive(hashToken(refreshRaw));
    if (!current) throw new AuthenticationError('Invalid refresh token');
    const user = await users.findById(current.userId);
    if (!user) throw new AuthenticationError('Invalid refresh token');
    const nextRaw = randomToken();
    await refreshTokens.rotate(current.id, { userId: user.id, tokenHash: hashToken(nextRaw), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
    return { ...tokensFor(user), refreshToken: nextRaw };
  }` : `async refresh() { throw new AuthenticationError('Refresh tokens are not enabled'); }`}
  async forgotPassword(emailRaw${t(c, ': string')}) {
    const user = await users.findByEmail(emailRaw.trim().toLowerCase());
    if (!user) return { sent: true };
    const raw = randomToken();
    await passwordResets.create({ userId: user.id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + 3600000) });
    return { sent: true, ...(env.NODE_ENV === 'development' ? { debugToken: raw } : {}) };
  }
  async resetPassword(input${t(c, ': { token: string; password: string }')}) {
    const record = await passwordResets.findActive(hashToken(input.token));
    if (!record) throw new ValidationError('Invalid or expired reset token');
    await users.update(record.userId, { passwordHash: await hashPassword(input.password), failedLoginAttempts: 0, lockedUntil: null });
    await passwordResets.markUsed(record.id);
    ${hasRefresh(c) ? 'await refreshTokens.revokeAllForUser(record.userId);' : ''}
    return { reset: true };
  }
  async verifyEmail(token${t(c, ': string')}) {
    const record = await emailVerifications.findActive(hashToken(token));
    if (!record) throw new ValidationError('Invalid or expired verification token');
    await users.update(record.userId, { emailVerifiedAt: new Date() });
    await emailVerifications.markUsed(record.id);
    return { verified: true };
  }
  async me(userId${t(c, ': string')}) {
    const user = await users.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return publicUser(user);
  }
}
export const authService = new AuthService();
`,
  );
}

function writeAuthSchemas(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const file = ctxPaths(ctx).apiFile('schemas', 'auth.schema', apiMod(c, 'auth'));
  writeSrc(ctx, file, `${validationImport(c)}${authSchemas(c)}`);
}

function authSchemas(c: StarterConfig): string {
  if (c.validation === 'zod' || !c.validation) {
    return `export const registerSchema = z.object({ body: z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().max(80).optional() }) });
export const loginSchema = z.object({ body: z.object({ email: z.string().email(), password: z.string().min(1) }) });
export const forgotSchema = z.object({ body: z.object({ email: z.string().email() }) });
export const resetSchema = z.object({ body: z.object({ token: z.string().min(1), password: z.string().min(8) }) });
export const verifySchema = z.object({ body: z.object({ token: z.string().min(1) }) });
`;
  }
  if (c.validation === 'yup') {
    return `export const registerSchema = yup.object({ body: yup.object({ email: yup.string().email().required(), password: yup.string().min(8).required(), name: yup.string().max(80) }) });
export const loginSchema = yup.object({ body: yup.object({ email: yup.string().email().required(), password: yup.string().required() }) });
export const forgotSchema = yup.object({ body: yup.object({ email: yup.string().email().required() }) });
export const resetSchema = yup.object({ body: yup.object({ token: yup.string().required(), password: yup.string().min(8).required() }) });
export const verifySchema = yup.object({ body: yup.object({ token: yup.string().required() }) });
`;
  }
  if (c.validation === 'joi') {
    return `export const registerSchema = Joi.object({ body: Joi.object({ email: Joi.string().email().required(), password: Joi.string().min(8).required(), name: Joi.string() }) });
export const loginSchema = Joi.object({ body: Joi.object({ email: Joi.string().email().required(), password: Joi.string().required() }) });
export const forgotSchema = Joi.object({ body: Joi.object({ email: Joi.string().email().required() }) });
export const resetSchema = Joi.object({ body: Joi.object({ token: Joi.string().required(), password: Joi.string().min(8).required() }) });
export const verifySchema = Joi.object({ body: Joi.object({ token: Joi.string().required() }) });
`;
  }
  return `export const registerSchema = v.object({ body: v.object({ email: v.pipe(v.string(), v.email()), password: v.pipe(v.string(), v.minLength(8)), name: v.optional(v.string()) }) });
export const loginSchema = v.object({ body: v.object({ email: v.pipe(v.string(), v.email()), password: v.string() }) });
export const forgotSchema = v.object({ body: v.object({ email: v.pipe(v.string(), v.email()) }) });
export const resetSchema = v.object({ body: v.object({ token: v.string(), password: v.pipe(v.string(), v.minLength(8)) }) });
export const verifySchema = v.object({ body: v.object({ token: v.string() }) });
`;
}

function writeAuthController(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('controllers', 'auth.controller', apiMod(c, 'auth'));
  const svc = relImport(file, p.apiFile('services', 'auth.service', apiMod(c, 'auth')));
  const cookies = relImport(file, p.apiFile('lib', 'cookies'));
  const response = relImport(file, p.apiFile('utils', 'api-response'));
  const asyncH = relImport(file, p.apiFile('utils', 'async-handler'));
  const refreshLine = hasRefresh(c);
  if (isFastify(c)) {
    writeSrc(
      ctx,
      file,
      `import { authService } from '${svc}';
import { ok, created } from '${response}';
import { setAuthCookies, clearAuthCookies, readRefreshCookie } from '${cookies}';
export async function register(request, reply) { const result = await authService.register(request.body); setAuthCookies(reply, result); return reply.status(201).send(created({ user: result.user, accessToken: result.accessToken })); }
export async function login(request, reply) { const result = await authService.login(request.body); setAuthCookies(reply, result); return ok({ user: result.user, accessToken: result.accessToken }); }
export async function logout(request, reply) { await authService.logout(readRefreshCookie(request) ?? request.body?.refreshToken); clearAuthCookies(reply); return ok({ loggedOut: true }); }
${refreshLine ? 'export async function refresh(request, reply) { const result = await authService.refresh(readRefreshCookie(request) ?? request.body?.refreshToken); setAuthCookies(reply, result); return ok({ user: result.user, accessToken: result.accessToken }); }' : ''}
export async function forgotPassword(request) { return ok(await authService.forgotPassword(request.body.email)); }
export async function resetPassword(request) { return ok(await authService.resetPassword(request.body)); }
export async function verifyEmail(request) { return ok(await authService.verifyEmail(request.body.token)); }
`,
    );
    return;
  }
  writeSrc(
    ctx,
    file,
    `import { asyncHandler } from '${asyncH}';
import { authService } from '${svc}';
import { ok, created } from '${response}';
import { setAuthCookies, clearAuthCookies, readRefreshCookie } from '${cookies}';
export const register = asyncHandler(async (req, res) => { const result = await authService.register(req.body); setAuthCookies(res, result); res.status(201).json(created({ user: result.user, accessToken: result.accessToken })); });
export const login = asyncHandler(async (req, res) => { const result = await authService.login(req.body); setAuthCookies(res, result); res.json(ok({ user: result.user, accessToken: result.accessToken })); });
export const logout = asyncHandler(async (req, res) => { await authService.logout(readRefreshCookie(req) ?? req.body?.refreshToken); clearAuthCookies(res); res.json(ok({ loggedOut: true })); });
${refreshLine ? 'export const refresh = asyncHandler(async (req, res) => { const result = await authService.refresh(readRefreshCookie(req) ?? req.body?.refreshToken); setAuthCookies(res, result); res.json(ok({ user: result.user, accessToken: result.accessToken })); });' : ''}
export const forgotPassword = asyncHandler(async (req, res) => { res.json(ok(await authService.forgotPassword(req.body.email))); });
export const resetPassword = asyncHandler(async (req, res) => { res.json(ok(await authService.resetPassword(req.body))); });
export const verifyEmail = asyncHandler(async (req, res) => { res.json(ok(await authService.verifyEmail(req.body.token))); });
`,
  );
}

function writeAuthRoutes(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('routes', 'auth.routes', apiMod(c, 'auth'));
  const controller = relImport(file, p.apiFile('controllers', 'auth.controller', apiMod(c, 'auth')));
  const schemas = relImport(file, p.apiFile('schemas', 'auth.schema', apiMod(c, 'auth')));
  const validate = relImport(file, p.apiFile('middleware', 'validate'));
  const rate = relImport(file, p.apiFile('middleware', 'rate-limit'));
  const refreshLine = hasRefresh(c);
  if (isFastify(c)) {
    writeSrc(
      ctx,
      file,
      `${typeImport(c, `import type { FastifyInstance } from 'fastify';\n`)}import * as authController from '${controller}';
import { validate } from '${validate}';
import { registerSchema, loginSchema, forgotSchema, resetSchema, verifySchema } from '${schemas}';
import { authRateLimit, sensitiveRateLimit } from '${rate}';
export async function authRouter(app${t(c, ': FastifyInstance')}) {
  app.post('/register', { config: { rateLimit: authRateLimit }, preHandler: validate(registerSchema) }, authController.register);
  app.post('/login', { config: { rateLimit: authRateLimit }, preHandler: validate(loginSchema) }, authController.login);
  app.post('/logout', authController.logout);
  ${refreshLine ? 'app.post(\'/refresh\', { config: { rateLimit: authRateLimit } }, authController.refresh);' : ''}
  app.post('/forgot-password', { config: { rateLimit: sensitiveRateLimit }, preHandler: validate(forgotSchema) }, authController.forgotPassword);
  app.post('/reset-password', { config: { rateLimit: sensitiveRateLimit }, preHandler: validate(resetSchema) }, authController.resetPassword);
  app.post('/verify-email', { config: { rateLimit: sensitiveRateLimit }, preHandler: validate(verifySchema) }, authController.verifyEmail);
}
`,
    );
  } else {
    writeSrc(
      ctx,
      file,
      `import { Router } from 'express';
import * as authController from '${controller}';
import { validate } from '${validate}';
import { registerSchema, loginSchema, forgotSchema, resetSchema, verifySchema } from '${schemas}';
import { authLimiter, sensitiveLimiter } from '${rate}';
export const authRouter = Router();
authRouter.post('/register', authLimiter, validate(registerSchema), authController.register);
authRouter.post('/login', authLimiter, validate(loginSchema), authController.login);
authRouter.post('/logout', authController.logout);
${refreshLine ? 'authRouter.post(\'/refresh\', authLimiter, authController.refresh);' : ''}
authRouter.post('/forgot-password', sensitiveLimiter, validate(forgotSchema), authController.forgotPassword);
authRouter.post('/reset-password', sensitiveLimiter, validate(resetSchema), authController.resetPassword);
authRouter.post('/verify-email', sensitiveLimiter, validate(verifySchema), authController.verifyEmail);
`,
    );
  }
  const v1 = p.apiSrc(`routes/v1/${fileName(c, 'index')}`);
  ctx.addRoute({
    name: 'auth',
    importStatement: `import { authRouter } from '${relImport(v1, file)}';`,
    mountPath: '/auth',
    routerIdentifier: 'authRouter',
    order: 20,
  });
}

function writeAuthMiddleware(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('middleware', 'authenticate', apiMod(c, 'auth'));
  const jwt = hasJwt(c) || hasOAuth(c);
  const http = httpTypes(c);
  const userLoad = `const user = await users.findById(${jwt ? 'claims.sub' : 'userId'});
    if (!user) throw new AuthenticationError();
    ${isFastify(c) ? 'request' : 'req'}.user = { id: user.id, email: user.email, roles: ${jwt ? 'claims.roles ?? []' : '[]'}, permissions: [] };`;
  const extract = jwt
    ? `const header = ${isFastify(c) ? 'request.headers.authorization' : 'req.headers.authorization'};
    const cookieToken = ${isFastify(c) ? 'request.cookies?.[authConfig.accessCookie]' : 'req.cookies?.[authConfig.accessCookie]'};
    const token = header?.startsWith('Bearer ') ? header.slice(7) : cookieToken;
    if (!token) throw new AuthenticationError();
    const claims = verifyAccessToken(token);`
    : `const userId = ${isFastify(c) ? 'request.session?.userId' : 'req.session?.userId'};
    if (!userId) throw new AuthenticationError();`;
  writeSrc(
    ctx,
    file,
    `${http.importLine}import { AuthenticationError } from '${relImport(file, p.apiFile('errors', 'index'))}';
${jwt ? `import { verifyAccessToken } from '${relImport(file, p.apiFile('lib', 'tokens'))}';\nimport { authConfig } from '${relImport(file, p.apiFile('config', 'auth'))}';` : ''}
import { UserRepository } from '${relImport(file, p.apiFile('repositories', 'user.repository', apiMod(c, 'auth')))}';
const users = new UserRepository();
export async function authenticate(${isFastify(c) ? `request${t(c, ': FastifyRequest')}` : params(c, [['req', 'Request'], ['_res', 'Response'], ['next', 'NextFunction']])}) {
  ${isFastify(c) ? `${extract}\n    ${userLoad}` : `try { ${extract} ${userLoad} next(); } catch (error) { next(error); }`}
}
`,
  );
}

function writeRbac(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('middleware', 'authorize', apiMod(c, 'auth'));
  const http = httpTypes(c);
  writeSrc(
    ctx,
    file,
    `${http.importLine}import { AuthenticationError, AuthorizationError } from '${relImport(file, p.apiFile('errors', 'index'))}';
export function requireRole(...roles${t(c, ': string[]')}) {
  return (${params(c, [['req', isFastify(c) ? 'FastifyRequest' : 'Request'], ['_res', isFastify(c) ? 'FastifyReply' : 'Response'], ['next', 'NextFunction']])}) => {
    if (!req.user) return next(new AuthenticationError());
    if (roles.length && !roles.some((role) => req.user.roles?.includes(role))) return next(new AuthorizationError());
    next();
  };
}
export function requirePermission(...permissions${t(c, ': string[]')}) {
  return (${params(c, [['req', isFastify(c) ? 'FastifyRequest' : 'Request'], ['_res', isFastify(c) ? 'FastifyReply' : 'Response'], ['next', 'NextFunction']])}) => {
    if (!req.user) return next(new AuthenticationError());
    if (permissions.length && !permissions.some((item) => req.user.permissions?.includes(item))) return next(new AuthorizationError());
    next();
  };
}
`,
  );
  if (c.rbac === 'casl') {
    writeSrc(
      ctx,
      p.apiFile('lib', 'ability'),
      `import { AbilityBuilder, createMongoAbility } from '@casl/ability';
export function defineAbilityFor(user${t(c, ': { roles: string[] }')}) {
  const { can, build } = new AbilityBuilder(createMongoAbility);
  if (user.roles.includes('admin')) can('manage', 'all'); else can('read', 'User');
  return build();
}
`,
    );
  }
  if (c.rbac === 'accesscontrol') {
    writeSrc(
      ctx,
      p.apiFile('lib', 'access-control'),
      `import { AccessControl } from 'accesscontrol';
export const accessControl = new AccessControl({
  admin: { user: { 'create:any': ['*'], 'read:any': ['*'], 'update:any': ['*'], 'delete:any': ['*'] } },
  user: { user: { 'read:own': ['*'], 'update:own': ['*'] } },
});
`,
    );
  }
}

function writeOAuth(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const iface = p.apiFile('lib', 'oauth-provider', apiMod(c, 'auth'));
  const envFile = p.apiFile('config', 'env');
  const providers = c.oauthProviders.length ? c.oauthProviders : (['google'] as const);
  writeSrc(
    ctx,
    iface,
    `${interfaceBlock(c, `export interface OAuthProfile { provider: string; providerId: string; email: string; name?: string; }
export interface OAuthProvider { id: string; authorizationUrl(state: string): string; exchangeCode(code: string): Promise<OAuthProfile>; }
`)}
export class OAuthRegistry {
  constructor(providers${t(c, ': OAuthProvider[]')} = []) { this.providers = new Map(providers.map((item) => [item.id, item])); }
  ${t(c, 'private providers: Map<string, OAuthProvider>;\n', 'providers;\n')}
  get(id${t(c, ': string')}) { return this.providers.get(id); }
}
`,
  );
  const files = providers.map((id) => {
    const file = p.apiFile('adapters', `${id}.provider`, apiMod(c, 'auth'));
    writeSrc(ctx, file, oauthImpl(c, id, relImport(file, iface), relImport(file, envFile)));
    return file;
  });
  const factory = p.apiFile('lib', 'oauth-factory', apiMod(c, 'auth'));
  const imports = providers
    .map((id, i) => `import { ${cap(id)}Provider } from '${relImport(factory, files[i]!)}';`)
    .join('\n');
  writeSrc(
    ctx,
    factory,
    `${imports}
import { OAuthRegistry } from '${relImport(factory, iface)}';
export const oauthRegistry = new OAuthRegistry([${providers.map((id) => `new ${cap(id)}Provider()`).join(', ')}]);
`,
  );
  if (!isExpress(c)) return;
  const routes = p.apiFile('routes', 'oauth.routes', apiMod(c, 'auth'));
  writeSrc(
    ctx,
    routes,
    `import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { oauthRegistry } from '${relImport(routes, factory)}';
import { NotFoundError } from '${relImport(routes, p.apiFile('errors', 'index'))}';
import { UserRepository } from '${relImport(routes, p.apiFile('repositories', 'user.repository', apiMod(c, 'auth')))}';
import { signAccessToken, randomToken } from '${relImport(routes, p.apiFile('lib', 'tokens'))}';
import { hashPassword } from '${relImport(routes, p.apiFile('lib', 'password'))}';
import { setAuthCookies } from '${relImport(routes, p.apiFile('lib', 'cookies'))}';
import { ok } from '${relImport(routes, p.apiFile('utils', 'api-response'))}';
const users = new UserRepository();
export const oauthRouter = Router();
oauthRouter.get('/:provider', (req, res, next) => {
  const provider = oauthRegistry.get(String(req.params.provider));
  if (!provider) return next(new NotFoundError('Unknown OAuth provider'));
  const state = randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 600000 });
  res.redirect(provider.authorizationUrl(state));
});
oauthRouter.get('/:provider/callback', async (req, res, next) => {
  try {
    const provider = oauthRegistry.get(String(req.params.provider));
    if (!provider) throw new NotFoundError('Unknown OAuth provider');
    const profile = await provider.exchangeCode(String(req.query.code ?? ''));
    let user = await users.findByEmail(profile.email);
    if (!user) user = await users.create({ email: profile.email, passwordHash: await hashPassword(randomToken()), name: profile.name });
    const accessToken = signAccessToken({ sub: user.id, email: user.email });
    setAuthCookies(res, { accessToken });
    res.json(ok({ user: { id: user.id, email: user.email, name: user.name }, accessToken }));
  } catch (error) { next(error); }
});
`,
  );
  const v1 = p.apiSrc(`routes/v1/${fileName(c, 'index')}`);
  ctx.addRoute({
    name: 'oauth',
    importStatement: `import { oauthRouter } from '${relImport(v1, routes)}';`,
    mountPath: '/auth/oauth',
    routerIdentifier: 'oauthRouter',
    order: 21,
  });
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function oauthImpl(c: StarterConfig, id: string, iface: string, envImport: string): string {
  const upper = id.toUpperCase();
  const map: Record<string, { auth: string; token: string; user: string; scope: string }> = {
    google: { auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', user: 'https://www.googleapis.com/oauth2/v3/userinfo', scope: 'openid email profile' },
    github: { auth: 'https://github.com/login/oauth/authorize', token: 'https://github.com/login/oauth/access_token', user: 'https://api.github.com/user', scope: 'user:email' },
    facebook: { auth: 'https://www.facebook.com/v19.0/dialog/oauth', token: 'https://graph.facebook.com/v19.0/oauth/access_token', user: 'https://graph.facebook.com/me?fields=id,name,email', scope: 'email' },
    microsoft: { auth: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', user: 'https://graph.microsoft.com/v1.0/me', scope: 'openid email profile' },
    apple: { auth: 'https://appleid.apple.com/auth/authorize', token: 'https://appleid.apple.com/auth/token', user: '', scope: 'name email' },
    linkedin: { auth: 'https://www.linkedin.com/oauth/v2/authorization', token: 'https://www.linkedin.com/oauth/v2/accessToken', user: 'https://api.linkedin.com/v2/userinfo', scope: 'openid profile email' },
  };
  const ep = map[id] ?? map.google!;
  return `import { env } from '${envImport}';
${typeImport(c, `import type { OAuthProfile, OAuthProvider } from '${iface}';\n`)}
export class ${cap(id)}Provider ${t(c, 'implements OAuthProvider ', '')}{
  id = '${id}';
  authorizationUrl(state${t(c, ': string')}) {
    const params = new URLSearchParams({ client_id: env.${upper}_CLIENT_ID, redirect_uri: env.${upper}_CALLBACK_URL, response_type: 'code', scope: '${ep.scope}', state });
    return '${ep.auth}?' + params.toString();
  }
  async exchangeCode(code${t(c, ': string')})${t(c, ': Promise<OAuthProfile>')} {
    const tokenRes = await fetch('${ep.token}', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.${upper}_CLIENT_ID, client_secret: env.${upper}_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: env.${upper}_CALLBACK_URL }) });
    const tokenJson = await tokenRes.json();
    ${ep.user ? `const profile = await (await fetch('${ep.user}', { headers: { Authorization: 'Bearer ' + tokenJson.access_token, Accept: 'application/json' } })).json();
    return { provider: '${id}', providerId: String(profile.id ?? profile.sub), email: String(profile.email ?? profile.mail), name: profile.name ?? profile.login };` : `return { provider: '${id}', providerId: 'unknown', email: tokenJson.email ?? '' };`}
  }
}
`;
}

function writeSession(ctx: GenerationContextLike): void {
  if (!isExpress(ctx.config)) return;
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('middleware', 'session');
  writeSrc(
    ctx,
    file,
    `import session from 'express-session';
import { authConfig } from '${relImport(file, p.apiFile('config', 'auth'))}';
${c.cache === 'redis' ? `import { RedisStore } from 'connect-redis';\nimport { redis } from '${relImport(file, p.apiFile('lib', 'redis'))}';` : ''}
export const sessionMiddleware = session({
  secret: authConfig.sessionSecret, name: authConfig.sessionName, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: authConfig.cookieSecure, sameSite: 'lax', maxAge: 86400000 },
  ${c.cache === 'redis' ? "store: new RedisStore({ client: redis, prefix: 'sess:' })," : ''}
});
`,
  );
  ctx.addMiddleware({
    name: 'session',
    importStatement: `import { sessionMiddleware } from '${relImport(p.apiSrc(fileName(c, 'app')), file)}';`,
    useStatement: 'app.use(sessionMiddleware);',
    order: 55,
  });
}

