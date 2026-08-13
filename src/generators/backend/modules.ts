import type {
  GenerationContextLike,
  Generator,
  PaymentProviderId,
  StarterConfig,
  StorageProviderId,
  ValidationResult,
} from '../../core/types.js';
import { emptyValidation } from '../../core/types.js';
import { addApiDeps, ctxPaths, fileName, isTs } from '../helpers.js';
import {
  apiMod,
  hasAuth,
  interfaceBlock,
  isExpress,
  isFastify,
  relImport,
  t,
  typeImport,
  writeSrc,
} from './shared.js';

export class ModulesGenerator implements Generator {
  id() {
    return 'backend-modules';
  }

  supports(_config: StarterConfig) {
    return true;
  }

  validate(_config: StarterConfig): ValidationResult {
    return emptyValidation();
  }

  async generate(context: GenerationContextLike): Promise<void> {
    const c = context.config;
    if (hasAuth(c)) writeUsers(context);
    if (c.payments.length) writePayments(context);
    if (c.storage !== 'none') writeStorage(context);
    if (c.email !== 'none') writeEmail(context);
    if (c.notifications.length) writeNotifications(context);
    if (c.search !== 'none') writeSearch(context);
    if (c.queue === 'bullmq') writeQueue(context);
    if (c.websockets !== 'none') writeWebsockets(context);
    if (c.multiTenancy !== 'none') writeTenancy(context);
    if (c.cqrs !== 'none') writeCqrs(context);
    if (c.events !== 'none') writeEvents(context);
    if (c.auditLog) writeAudit(context);
    if (c.admin === 'custom') writeAdmin(context);
  }
}

function writeUsers(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const mod = apiMod(c, 'users');
  const service = p.apiFile('services', 'user.service', mod);
  const controller = p.apiFile('controllers', 'user.controller', mod);
  const routes = p.apiFile('routes', 'user.routes', mod);
  const repo = p.apiFile('repositories', 'user.repository', apiMod(c, 'auth'));
  const authMw = p.apiFile('middleware', 'authenticate', apiMod(c, 'auth'));
  const rbac = p.apiFile('middleware', 'authorize', apiMod(c, 'auth'));
  const asyncH = p.apiFile('utils', 'async-handler');
  const response = p.apiFile('utils', 'api-response');
  const pager = p.apiFile('utils', 'pagination');
  const errors = p.apiFile('errors', 'index');

  writeSrc(
    ctx,
    service,
    `import { UserRepository } from '${relImport(service, repo)}';
import { NotFoundError } from '${relImport(service, errors)}';
const users = new UserRepository();
export class UserService {
  me(id${t(c, ': string')}) { return users.findById(id); }
  async updateMe(id${t(c, ': string')}, data${t(c, ': { name?: string }')}) {
    const user = await users.update(id, { name: data.name });
    if (!user) throw new NotFoundError('User not found');
    return { id: user.id, email: user.email, name: user.name };
  }
  async list(skip${t(c, ': number')}, take${t(c, ': number')}) {
    const [items, total] = await Promise.all([users.list(skip, take), users.count()]);
    return { items, total };
  }
}
export const userService = new UserService();
`,
  );

  if (isFastify(c)) {
    writeSrc(
      ctx,
      controller,
      `import { userService } from '${relImport(controller, service)}';
import { ok } from '${relImport(controller, response)}';
import { parseOffset, offsetMeta } from '${relImport(controller, pager)}';
export async function me(request) { return ok(await userService.me(request.user.id)); }
export async function updateMe(request) { return ok(await userService.updateMe(request.user.id, request.body)); }
export async function list(request) {
  const { skip, take, page, limit } = parseOffset(request.query);
  const { items, total } = await userService.list(skip, take);
  return ok(items, offsetMeta(page, limit, total));
}
`,
    );
    writeSrc(
      ctx,
      routes,
      `${typeImport(c, `import type { FastifyInstance } from 'fastify';\n`)}import * as userController from '${relImport(routes, controller)}';
import { authenticate } from '${relImport(routes, authMw)}';
${c.rbac !== 'none' ? `import { requireRole } from '${relImport(routes, rbac)}';` : ''}
export async function usersRouter(app${t(c, ': FastifyInstance')}) {
  app.get('/me', { preHandler: authenticate }, userController.me);
  app.patch('/me', { preHandler: authenticate }, userController.updateMe);
  ${c.rbac !== 'none' ? "app.get('/', { preHandler: [authenticate, requireRole('admin')] }, userController.list);" : ''}
}
`,
    );
  } else {
    writeSrc(
      ctx,
      controller,
      `import { asyncHandler } from '${relImport(controller, asyncH)}';
import { userService } from '${relImport(controller, service)}';
import { ok } from '${relImport(controller, response)}';
import { parseOffset, offsetMeta } from '${relImport(controller, pager)}';
export const me = asyncHandler(async (req, res) => { res.json(ok(await userService.me(req.user.id))); });
export const updateMe = asyncHandler(async (req, res) => { res.json(ok(await userService.updateMe(req.user.id, req.body))); });
export const list = asyncHandler(async (req, res) => {
  const { skip, take, page, limit } = parseOffset(req.query);
  const { items, total } = await userService.list(skip, take);
  res.json(ok(items, offsetMeta(page, limit, total)));
});
`,
    );
    writeSrc(
      ctx,
      routes,
      `import { Router } from 'express';
import * as userController from '${relImport(routes, controller)}';
import { authenticate } from '${relImport(routes, authMw)}';
${c.rbac !== 'none' ? `import { requireRole } from '${relImport(routes, rbac)}';` : ''}
export const usersRouter = Router();
usersRouter.get('/me', authenticate, userController.me);
usersRouter.patch('/me', authenticate, userController.updateMe);
${c.rbac !== 'none' ? "usersRouter.get('/', authenticate, requireRole('admin'), userController.list);" : ''}
`,
    );
  }
  const v1 = p.apiSrc(`routes/v1/${fileName(c, 'index')}`);
  ctx.addRoute({
    name: 'users',
    importStatement: `import { usersRouter } from '${relImport(v1, routes)}';`,
    mountPath: '/users',
    routerIdentifier: 'usersRouter',
    order: 30,
  });
}

function writePayments(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const mod = apiMod(c, 'payments');
  addApiDeps(ctx, c.payments.includes('stripe') ? [['stripe', '^17.7.0']] : []);
  const envFile = p.apiFile('config', 'env');
  const payCfg = p.apiFile('config', 'payment');
  writeSrc(
    ctx,
    payCfg,
    `import { env } from '${relImport(payCfg, envFile)}';
export const paymentConfig = {
  ${c.payments.includes('stripe') ? 'stripeSecretKey: env.STRIPE_SECRET_KEY,\n  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,' : ''}
};
`,
  );

  const port = p.apiFile('ports', 'payment-gateway', mod);
  writeSrc(
    ctx,
    port,
    `${interfaceBlock(c, `export interface CreatePaymentInput { amount: number; currency: string; idempotencyKey: string; metadata?: Record<string, string>; }
export interface PaymentResult { id: string; status: string; clientSecret?: string | null; }
export interface PaymentGateway {
  readonly provider: string;
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  parseWebhook?(rawBody: Buffer, signature: string): Promise<{ id: string; status: string }>;
}
`)}
`,
  );

  const multiple = c.payments.length > 1;
  for (const provider of c.payments) {
    writeAdapter(ctx, provider, port, payCfg, mod);
  }

  const factory = p.apiFile('lib', 'payment-factory', mod);
  const adapters = c.payments.map((id) => p.apiFile('adapters', `${id}.adapter`, mod));
  writeSrc(
    ctx,
    factory,
    `${c.payments.map((id, i) => `import { ${cap(id)}Adapter } from '${relImport(factory, adapters[i]!)}';`).join('\n')}
${typeImport(c, `import type { PaymentGateway } from '${relImport(factory, port)}';\n`)}
const gateways = [${c.payments.map((id) => `new ${cap(id)}Adapter()`).join(', ')}];
export function paymentGateway(provider${t(c, '?: string')})${t(c, ': PaymentGateway')} {
  const found = gateways.find((item) => item.provider === (provider ?? '${c.payments[0]}'));
  if (!found) throw new Error('Unknown payment provider');
  return found;
}
${multiple ? `export function allPaymentGateways() { return gateways; }\n` : ''}
`,
  );

  const service = p.apiFile('services', 'payment.service', mod);
  const errors = p.apiFile('errors', 'index');
  writeSrc(
    ctx,
    service,
    `import { paymentGateway } from '${relImport(service, factory)}';
import { ValidationError } from '${relImport(service, errors)}';
${c.orm === 'prisma' ? `import { prisma } from '${relImport(service, p.apiFile('lib', 'db'))}';` : ''}
export class PaymentService {
  async create(input${t(c, ': { amount: number; currency: string; idempotencyKey: string; provider?: string }')}) {
    if (input.amount <= 0) throw new ValidationError('Amount must be positive');
    const gateway = paymentGateway(input.provider);
    const result = await gateway.createPayment(input);
    ${c.orm === 'prisma' ? `await prisma.payment.upsert({ where: { idempotencyKey: input.idempotencyKey }, update: { status: mapStatus(result.status), providerPaymentId: result.id }, create: { provider: gateway.provider, providerPaymentId: result.id, amount: input.amount, currency: input.currency, status: mapStatus(result.status), idempotencyKey: input.idempotencyKey } });` : ''}
    return result;
  }
  async handleStripeWebhook(rawBody${t(c, ': Buffer')}, signature${t(c, ': string')}) {
    const gateway = paymentGateway('stripe');
    if (!gateway.parseWebhook) throw new ValidationError('Webhook not supported');
    const event = await gateway.parseWebhook(rawBody, signature);
    ${c.orm === 'prisma' ? `await prisma.payment.updateMany({ where: { providerPaymentId: event.id }, data: { status: mapStatus(event.status) } });` : ''}
    return event;
  }
}
function mapStatus(status${t(c, ': string')}) {
  if (status === 'succeeded' || status === 'paid') return 'succeeded';
  if (status === 'canceled' || status === 'cancelled') return 'canceled';
  if (status === 'requires_payment_method' || status === 'failed') return 'failed';
  return 'pending';
}
export const paymentService = new PaymentService();
`,
  );

  const controller = p.apiFile('controllers', 'payment.controller', mod);
  const routes = p.apiFile('routes', 'payment.routes', mod);
  const authMw = p.apiFile('middleware', 'authenticate', apiMod(c, 'auth'));
  if (isExpress(c)) {
    writeSrc(
      ctx,
      controller,
      `import { asyncHandler } from '${relImport(controller, p.apiFile('utils', 'async-handler'))}';
import { paymentService } from '${relImport(controller, service)}';
import { ok, created } from '${relImport(controller, p.apiFile('utils', 'api-response'))}';
export const create = asyncHandler(async (req, res) => {
  const result = await paymentService.create(req.body);
  res.status(201).json(created(result));
});
export const webhook = asyncHandler(async (req, res) => {
  const signature = String(req.headers['stripe-signature'] ?? '');
  const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
  res.json(ok(await paymentService.handleStripeWebhook(raw, signature)));
});
`,
    );
    writeSrc(
      ctx,
      routes,
      `import { Router } from 'express';
import * as paymentController from '${relImport(routes, controller)}';
${hasAuth(c) ? `import { authenticate } from '${relImport(routes, authMw)}';` : ''}
export const paymentsRouter = Router();
paymentsRouter.post('/', ${hasAuth(c) ? 'authenticate, ' : ''}paymentController.create);
${c.payments.includes('stripe') ? 'paymentsRouter.post(\'/webhook\', paymentController.webhook);' : ''}
`,
    );
  } else {
    writeSrc(
      ctx,
      controller,
      `import { paymentService } from '${relImport(controller, service)}';
import { ok, created } from '${relImport(controller, p.apiFile('utils', 'api-response'))}';
export async function create(request, reply) { return reply.status(201).send(created(await paymentService.create(request.body))); }
export async function webhook(request) { return ok(await paymentService.handleStripeWebhook(Buffer.from(JSON.stringify(request.body)), String(request.headers['stripe-signature'] ?? ''))); }
`,
    );
    writeSrc(
      ctx,
      routes,
      `${typeImport(c, `import type { FastifyInstance } from 'fastify';\n`)}import * as paymentController from '${relImport(routes, controller)}';
export async function paymentsRouter(app${t(c, ': FastifyInstance')}) {
  app.post('/', paymentController.create);
  ${c.payments.includes('stripe') ? "app.post('/webhook', { config: { rawBody: true } }, paymentController.webhook);" : ''}
}
`,
    );
  }
  const v1 = p.apiSrc(`routes/v1/${fileName(c, 'index')}`);
  ctx.addRoute({
    name: 'payments',
    importStatement: `import { paymentsRouter } from '${relImport(v1, routes)}';`,
    mountPath: '/payments',
    routerIdentifier: 'paymentsRouter',
    order: 40,
  });
}

function writeAdapter(
  ctx: GenerationContextLike,
  provider: PaymentProviderId,
  portFile: string,
  payCfg: string,
  mod: string | undefined,
): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('adapters', `${provider}.adapter`, mod);
  if (provider === 'stripe') {
    writeSrc(
      ctx,
      file,
      `import Stripe from 'stripe';
import { paymentConfig } from '${relImport(file, payCfg)}';
${typeImport(c, `import type { CreatePaymentInput, PaymentGateway, PaymentResult } from '${relImport(file, portFile)}';\n`)}
export class StripeAdapter ${t(c, 'implements PaymentGateway ', '')}{
  readonly provider = 'stripe';
  constructor(private readonly stripe = new Stripe(paymentConfig.stripeSecretKey)) {}
  async createPayment(input${t(c, ': CreatePaymentInput')})${t(c, ': Promise<PaymentResult>')} {
    const intent = await this.stripe.paymentIntents.create({
      amount: input.amount, currency: input.currency, metadata: input.metadata, automatic_payment_methods: { enabled: true },
    }, { idempotencyKey: input.idempotencyKey });
    return { id: intent.id, status: intent.status, clientSecret: intent.client_secret };
  }
  async parseWebhook(rawBody${t(c, ': Buffer')}, signature${t(c, ': string')}) {
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, paymentConfig.stripeWebhookSecret);
    const obj = event.data.object${t(c, ' as { id?: string; payment_intent?: string; status?: string }')};
    return { id: String(obj.payment_intent ?? obj.id ?? ''), status: String(obj.status ?? event.type) };
  }
}
`,
    );
    return;
  }
  writeSrc(
    ctx,
    file,
    `${typeImport(c, `import type { CreatePaymentInput, PaymentGateway } from '${relImport(file, portFile)}';\n`)}import { NotImplementedError } from '${relImport(file, p.apiFile('errors', 'index'))}';
export class ${cap(provider)}Adapter ${t(c, 'implements PaymentGateway ', '')}{
  readonly provider = '${provider}';
  async createPayment(_input${t(c, ': CreatePaymentInput')}) { throw new NotImplementedError('${cap(provider)} payments are not implemented in this starter'); }
}
`,
  );
}

function writeStorage(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const mod = apiMod(c, 'storage');
  if (c.storage === 's3' || c.storage === 'r2' || c.storage === 'minio') {
    addApiDeps(ctx, [['@aws-sdk/client-s3', '^3.782.0']]);
    ctx.addEnv({ key: 'S3_BUCKET', example: 'app-uploads', required: true, description: 'Object storage bucket', workspace: 'api' });
    ctx.addEnv({ key: 'S3_REGION', example: 'us-east-1', required: false, description: 'Object storage region', workspace: 'api' });
    ctx.addEnv({ key: 'S3_ENDPOINT', example: '', required: false, description: 'Custom S3 endpoint', workspace: 'api' });
    ctx.addEnv({ key: 'S3_ACCESS_KEY', example: '', required: true, description: 'S3 access key', workspace: 'api', secret: true });
    ctx.addEnv({ key: 'S3_SECRET_KEY', example: '', required: true, description: 'S3 secret key', workspace: 'api', secret: true });
  }
  const port = p.apiFile('ports', 'storage-provider', mod);
  writeSrc(
    ctx,
    port,
    `${interfaceBlock(c, `export interface StorageProvider {
  upload(params: { buffer: Buffer; filename: string; mimeType: string }): Promise<string>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}
`)}
`,
  );
  const adapter = p.apiFile('adapters', `${c.storage}.storage`, mod);
  writeSrc(ctx, adapter, storageAdapter(c, c.storage, relImport(adapter, port), p, adapter));
  const service = p.apiFile('services', 'storage.service', mod);
  writeSrc(
    ctx,
    service,
    `import { ${cap(c.storage)}Storage } from '${relImport(service, adapter)}';
const provider = new ${cap(c.storage)}Storage();
export class StorageService {
  upload(file${t(c, ': { buffer: Buffer; filename: string; mimeType: string }')}) { return provider.upload(file); }
  delete(key${t(c, ': string')}) { return provider.delete(key); }
  getUrl(key${t(c, ': string')}) { return provider.getUrl(key); }
}
export const storageService = new StorageService();
`,
  );
}

function storageAdapter(
  c: StarterConfig,
  kind: StorageProviderId,
  portImport: string,
  p: ReturnType<typeof ctxPaths>,
  file: string,
): string {
  if (kind === 'local') {
    return `import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
${typeImport(c, `import type { StorageProvider } from '${portImport}';\n`)}
export class LocalStorage ${t(c, 'implements StorageProvider ', '')}{
  constructor(private readonly root = join(process.cwd(), 'uploads')) {}
  async upload(params${t(c, ': { buffer: Buffer; filename: string; mimeType: string }')}) {
    await mkdir(this.root, { recursive: true });
    const key = randomUUID() + '-' + params.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    await writeFile(join(this.root, key), params.buffer);
    return key;
  }
  async delete(key${t(c, ': string')}) { await unlink(join(this.root, key)); }
  async getUrl(key${t(c, ': string')}) { return '/uploads/' + key; }
}
`;
  }
  return `import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
${typeImport(c, `import type { StorageProvider } from '${portImport}';\n`)}
import { env } from '${relImport(file, p.apiFile('config', 'env'))}';
export class ${cap(kind)}Storage ${t(c, 'implements StorageProvider ', '')}{
  constructor(private readonly client = new S3Client({
    region: env.S3_REGION ?? 'us-east-1',
    endpoint: env.S3_ENDPOINT || undefined,
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    forcePathStyle: ${kind === 'minio' || kind === 'r2' ? 'true' : 'false'},
  })) {}
  async upload(params${t(c, ': { buffer: Buffer; filename: string; mimeType: string }')}) {
    const key = randomUUID() + '-' + params.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    await this.client.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: params.buffer, ContentType: params.mimeType }));
    return key;
  }
  async delete(key${t(c, ': string')}) { await this.client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key })); }
  async getUrl(key${t(c, ': string')}) { return (env.S3_ENDPOINT ? env.S3_ENDPOINT.replace(/\\/$/, '') + '/' : '') + env.S3_BUCKET + '/' + key; }
}
`;
}

function writeEmail(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const mod = apiMod(c, 'email');
  if (c.email === 'smtp') {
    addApiDeps(ctx, [['nodemailer', '^6.10.0']]);
    ctx.addEnv({ key: 'SMTP_HOST', example: 'localhost', required: true, description: 'SMTP host', workspace: 'api' });
    ctx.addEnv({ key: 'SMTP_PORT', example: '1025', required: false, description: 'SMTP port', workspace: 'api' });
    ctx.addEnv({ key: 'SMTP_USER', example: '', required: false, description: 'SMTP username', workspace: 'api' });
    ctx.addEnv({ key: 'SMTP_PASS', example: '', required: false, description: 'SMTP password', workspace: 'api', secret: true });
    ctx.addEnv({ key: 'SMTP_FROM', example: 'noreply@localhost', required: false, description: 'From address', workspace: 'api' });
  }
  if (c.email === 'resend') addApiDeps(ctx, [['resend', '^4.2.0']]);
  const port = p.apiFile('ports', 'email-provider', mod);
  writeSrc(
    ctx,
    port,
    `${interfaceBlock(c, `export interface EmailMessage { to: string; subject: string; html: string; text?: string; }
export interface EmailProvider { send(message: EmailMessage): Promise<void>; }
`)}
`,
  );
  const adapter = p.apiFile('adapters', `${c.email}.email`, mod);
  writeSrc(ctx, adapter, emailAdapter(c, relImport(adapter, port), relImport(adapter, p.apiFile('config', 'env'))));
  const service = p.apiFile('services', 'email.service', mod);
  writeSrc(
    ctx,
    service,
    `import { ${cap(c.email)}Email } from '${relImport(service, adapter)}';
const provider = new ${cap(c.email)}Email();
export class EmailService {
  send(message${t(c, ': { to: string; subject: string; html: string; text?: string }')}) { return provider.send(message); }
}
export const emailService = new EmailService();
`,
  );
}

function emailAdapter(c: StarterConfig, portImport: string, envImport: string): string {
  if (c.email === 'resend') {
    return `import { Resend } from 'resend';
import { env } from '${envImport}';
${typeImport(c, `import type { EmailMessage, EmailProvider } from '${portImport}';\n`)}
export class ResendEmail ${t(c, 'implements EmailProvider ', '')}{
  constructor(private readonly client = new Resend(env.RESEND_API_KEY)) {}
  async send(message${t(c, ': EmailMessage')}) { await this.client.emails.send({ from: 'noreply@localhost', to: message.to, subject: message.subject, html: message.html }); }
}
`;
  }
  if (c.email === 'smtp') {
    return `import nodemailer from 'nodemailer';
import { env } from '${envImport}';
${typeImport(c, `import type { EmailMessage, EmailProvider } from '${portImport}';\n`)}
export class SmtpEmail ${t(c, 'implements EmailProvider ', '')}{
  constructor(private readonly transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT ?? 587), auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined })) {}
  async send(message${t(c, ': EmailMessage')}) { await this.transport.sendMail({ from: env.SMTP_FROM ?? 'noreply@localhost', to: message.to, subject: message.subject, html: message.html, text: message.text }); }
}
`;
  }
  return `${typeImport(c, `import type { EmailMessage, EmailProvider } from '${portImport}';\n`)}import { NotImplementedError } from '${envImport.replace(/config\/env\.js$/, 'errors/index.js')}';
export class ${cap(c.email)}Email ${t(c, 'implements EmailProvider ', '')}{
  async send(_message${t(c, ': EmailMessage')}) { throw new NotImplementedError('${c.email} is not fully wired in this starter'); }
}
`;
}

function writeNotifications(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const mod = apiMod(c, 'notifications');
  const service = p.apiFile('services', 'notification.service', mod);
  const emailService = p.apiFile('services', 'email.service', apiMod(c, 'email'));
  writeSrc(
    ctx,
    service,
    `${c.notifications.includes('email') && c.email !== 'none' ? `import { emailService } from '${relImport(service, emailService)}';` : ''}
${c.orm === 'prisma' && c.notifications.includes('database') ? `import { prisma } from '${relImport(service, p.apiFile('lib', 'db'))}';` : ''}
export class NotificationService {
  async notify(input${t(c, ': { userId: string; email?: string; title: string; body: string }')}) {
    ${c.notifications.includes('database') && c.orm === 'prisma' ? `await prisma.notification.create({ data: { userId: input.userId, channel: 'database', title: input.title, body: input.body } });` : ''}
    ${c.notifications.includes('email') && c.email !== 'none' ? `if (input.email) await emailService.send({ to: input.email, subject: input.title, html: input.body });` : ''}
  }
}
export const notificationService = new NotificationService();
`,
  );
}

function writeSearch(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const mod = apiMod(c, 'search');
  const service = p.apiFile('services', 'search.service', mod);
  const db = p.apiFile('lib', 'db');
  writeSrc(
    ctx,
    service,
    c.search === 'postgres-fts' && c.orm === 'prisma'
      ? `import { prisma } from '${relImport(service, db)}';
export class SearchService {
  async query(term${t(c, ': string')}) {
    return prisma.$queryRawUnsafe('SELECT id, email FROM users WHERE to_tsvector(coalesce(name, \\'\\') || \\' \\' || email) @@ plainto_tsquery($1) LIMIT 20', term);
  }
}
export const searchService = new SearchService();
`
      : `export class SearchService {
  async query(_term${t(c, ': string')}) { return []; }
}
export const searchService = new SearchService();
`,
  );
}

function writeQueue(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const emailQueue = p.apiFile('queues', 'email.queue');
  const notifQueue = p.apiFile('queues', 'notification.queue');
  const emailWorker = p.apiFile('workers', 'email.worker');
  const redisFile = p.apiFile('lib', 'redis');
  writeSrc(
    ctx,
    emailQueue,
    `import { Queue } from 'bullmq';
import { redis } from '${relImport(emailQueue, redisFile)}';
export const emailQueue = new Queue('email', { connection: redis });
export function enqueueEmail(data${t(c, ': { to: string; subject: string; html: string }')}) { return emailQueue.add('send', data, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }); }
`,
  );
  writeSrc(
    ctx,
    notifQueue,
    `import { Queue } from 'bullmq';
import { redis } from '${relImport(notifQueue, redisFile)}';
export const notificationQueue = new Queue('notification', { connection: redis });
export function enqueueNotification(data${t(c, ': Record<string, unknown>')}) { return notificationQueue.add('notify', data, { attempts: 3 }); }
`,
  );
  writeSrc(
    ctx,
    emailWorker,
    `import { Worker } from 'bullmq';
import { redis } from '${relImport(emailWorker, redisFile)}';
import { logger } from '${relImport(emailWorker, p.apiFile('lib', 'logger'))}';
${c.email !== 'none' ? `import { emailService } from '${relImport(emailWorker, p.apiFile('services', 'email.service', apiMod(c, 'email')))}';` : ''}
export const emailWorker = new Worker('email', async (job) => {
  ${c.email !== 'none' ? 'await emailService.send(job.data);' : 'logger.info({ jobId: job.id }, \'email_job\');'}
}, { connection: redis });
`,
  );
}

function writeWebsockets(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('lib', 'realtime');
  const tokens = p.apiFile('lib', 'tokens');
  if (c.websockets === 'socket.io') {
    writeSrc(
      ctx,
      file,
      `import { Server } from 'socket.io';
${hasAuth(c) && (c.auth !== 'session') ? `import { verifyAccessToken } from '${relImport(file, tokens)}';` : ''}
import { logger } from '${relImport(file, p.apiFile('lib', 'logger'))}';
${typeImport(c, `import type { Server as HttpServer } from 'node:http';\n`)}
export function attachRealtime(httpServer${t(c, ': HttpServer')}) {
  const io = new Server(httpServer, { cors: { origin: true, credentials: true } });
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token ?? socket.handshake.headers.authorization?.toString().replace('Bearer ', '');
      ${hasAuth(c) && c.auth !== 'session' ? 'if (!token) return next(new Error(\'UNAUTHENTICATED\'));\n      socket.data.user = verifyAccessToken(token);' : ''}
      next();
    } catch { next(new Error('UNAUTHENTICATED')); }
  });
  io.on('connection', (socket) => {
    const room = socket.data.user?.sub ? 'user:' + socket.data.user.sub : socket.id;
    socket.join(room);
    socket.emit('connected', { room });
    socket.on('message', (payload) => { io.to(room).emit('message', payload); });
  });
  logger.info('websocket_ready');
  return io;
}
`,
    );
    return;
  }
  writeSrc(
    ctx,
    file,
    `import { WebSocketServer } from 'ws';
import { logger } from '${relImport(file, p.apiFile('lib', 'logger'))}';
${typeImport(c, `import type { Server as HttpServer } from 'node:http';\n`)}
export function attachRealtime(httpServer${t(c, ': HttpServer')}) {
  const wss = new WebSocketServer({ server: httpServer });
  wss.on('connection', (socket) => {
    socket.on('message', (raw) => { for (const client of wss.clients) if (client.readyState === 1) client.send(raw.toString()); });
  });
  logger.info('websocket_ready');
  return wss;
}
`,
  );
}

function writeTenancy(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const mod = apiMod(c, 'tenants');
  const contextFile = p.apiFile('lib', 'tenant-context');
  const resolver = p.apiFile('lib', 'tenant-resolver');
  const mw = p.apiFile('middleware', 'tenant', mod);
  writeSrc(
    ctx,
    contextFile,
    `import { AsyncLocalStorage } from 'node:async_hooks';
${interfaceBlock(c, `export interface TenantContext { tenantId: string; slug?: string; }\n`)}
export const tenantStore = new AsyncLocalStorage${t(c, '<TenantContext>')}();
export function getTenant() { return tenantStore.getStore(); }
export function requireTenant() {
  const tenant = getTenant();
  if (!tenant) throw new Error('Tenant context missing');
  return tenant;
}
`,
  );
  writeSrc(
    ctx,
    resolver,
    `${c.orm === 'prisma' ? `import { prisma } from '${relImport(resolver, p.apiFile('lib', 'db'))}';` : ''}
export async function resolveTenant(header${t(c, '?: string')}, host${t(c, '?: string')}) {
  const slug = header || host?.split('.')[0];
  if (!slug) return null;
  ${c.orm === 'prisma' ? 'return prisma.tenant.findFirst({ where: { OR: [{ id: slug }, { slug }] } });' : 'return { id: slug, slug };'}
}
`,
  );
  if (isExpress(c)) {
    writeSrc(
      ctx,
      mw,
      `import { tenantStore } from '${relImport(mw, contextFile)}';
import { resolveTenant } from '${relImport(mw, resolver)}';
import { AuthenticationError } from '${relImport(mw, p.apiFile('errors', 'index'))}';
export async function tenantMiddleware(req, res, next) {
  try {
    const tenant = await resolveTenant(req.headers['x-tenant-id']?.toString(), req.hostname);
    if (!tenant) return next(new AuthenticationError('Tenant required'));
    tenantStore.run({ tenantId: tenant.id, slug: tenant.slug }, () => next());
  } catch (error) { next(error); }
}
`,
    );
    ctx.addMiddleware({
      name: 'tenant',
      importStatement: `import { tenantMiddleware } from '${relImport(p.apiSrc(fileName(c, 'app')), mw)}';`,
      useStatement: 'app.use(tenantMiddleware);',
      order: 65,
    });
  }
}

function writeCqrs(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const command = p.apiFile('usecases', 'get-user.query', apiMod(c, 'users'));
  const handler = p.apiFile('usecases', 'get-user.handler', apiMod(c, 'users'));
  const bus = p.apiFile('lib', 'command-bus');
  writeSrc(
    ctx,
    command,
    `${interfaceBlock(c, `export class GetUserQuery { constructor(public readonly userId: string) {} }\n`)}
export function getUserQuery(userId${t(c, ': string')}) { return { type: 'GetUser', userId }; }
`,
  );
  writeSrc(
    ctx,
    handler,
    `import { UserRepository } from '${relImport(handler, p.apiFile('repositories', 'user.repository', apiMod(c, 'auth')))}';
const users = new UserRepository();
export async function handleGetUser(query${t(c, ': { userId: string }')}) { return users.findById(query.userId); }
`,
  );
  writeSrc(
    ctx,
    bus,
    `const handlers = new Map();
export function registerHandler(type${t(c, ': string')}, handler${t(c, ': (payload: unknown) => Promise<unknown>')}) { handlers.set(type, handler); }
export function execute(type${t(c, ': string')}, payload${t(c, ': unknown')}) {
  const handler = handlers.get(type);
  if (!handler) throw new Error('No handler for ' + type);
  return handler(payload);
}
`,
  );
}

function writeEvents(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const file = p.apiFile('events', 'bus');
  if (c.events === 'redis-pubsub') {
    writeSrc(
      ctx,
      file,
      `import { redis } from '${relImport(file, p.apiFile('lib', 'redis'))}';
export async function publish(event${t(c, ': string')}, payload${t(c, ': unknown')}) { await redis.publish(event, JSON.stringify(payload)); }
export function subscribe(event${t(c, ': string')}, handler${t(c, ': (payload: unknown) => void')}) {
  const sub = redis.duplicate();
  void sub.subscribe(event).then(() => sub.on('message', (_ch, message) => handler(JSON.parse(message))));
}
`,
    );
    return;
  }
  if (c.events === 'queue') {
    writeSrc(
      ctx,
      file,
      `import { Queue, Worker } from 'bullmq';
import { redis } from '${relImport(file, p.apiFile('lib', 'redis'))}';
const events = new Queue('domain-events', { connection: redis });
export function publish(event${t(c, ': string')}, payload${t(c, ': unknown')}) { return events.add(event, payload); }
export function subscribe(event${t(c, ': string')}, handler${t(c, ': (payload: unknown) => Promise<void> | void')}) {
  return new Worker('domain-events', async (job) => { if (job.name === event) await handler(job.data); }, { connection: redis });
}
`,
    );
    return;
  }
  writeSrc(
    ctx,
    file,
    `import { EventEmitter } from 'node:events';
const bus = new EventEmitter();
export function publish(event${t(c, ': string')}, payload${t(c, ': unknown')}) { bus.emit(event, payload); }
export function subscribe(event${t(c, ': string')}, handler${t(c, ': (payload: unknown) => void')}) { bus.on(event, handler); }
`,
  );
}

function writeAudit(ctx: GenerationContextLike): void {
  const c = ctx.config;
  const p = ctxPaths(ctx);
  const service = p.apiFile('services', 'audit.service');
  const mw = p.apiFile('middleware', 'audit');
  writeSrc(
    ctx,
    service,
    `${c.orm === 'prisma' ? `import { prisma } from '${relImport(service, p.apiFile('lib', 'db'))}';` : ''}
export async function recordAudit(entry${t(c, ': { actorId?: string; action: string; entity: string; entityId?: string; ip?: string }')}) {
  ${c.orm === 'prisma' ? 'await prisma.auditLog.create({ data: entry });' : ''}
}
`,
  );
  if (isExpress(c)) {
    writeSrc(
      ctx,
      mw,
      `import { recordAudit } from '${relImport(mw, service)}';
export function auditMiddleware(req, res, next) {
  res.on('finish', () => {
    if (req.method === 'GET' || res.statusCode >= 400) return;
    void recordAudit({ actorId: req.user?.id, action: req.method + ' ' + req.originalUrl, entity: 'http', ip: req.ip });
  });
  next();
}
`,
    );
    ctx.addMiddleware({
      name: 'audit',
      importStatement: `import { auditMiddleware } from '${relImport(p.apiSrc(fileName(c, 'app')), mw)}';`,
      useStatement: 'app.use(auditMiddleware);',
      order: 70,
    });
  }
}

function writeAdmin(ctx: GenerationContextLike): void {
  const c = ctx.config;
  if (!hasAuth(c)) return;
  const p = ctxPaths(ctx);
  const routes = p.apiFile('routes', 'admin.routes', apiMod(c, 'admin'));
  const authMw = p.apiFile('middleware', 'authenticate', apiMod(c, 'auth'));
  const rbac = p.apiFile('middleware', 'authorize', apiMod(c, 'auth'));
  const users = p.apiFile('controllers', 'user.controller', apiMod(c, 'users'));
  if (isExpress(c)) {
    writeSrc(
      ctx,
      routes,
      `import { Router } from 'express';
import { authenticate } from '${relImport(routes, authMw)}';
import { requireRole } from '${relImport(routes, rbac)}';
import * as userController from '${relImport(routes, users)}';
export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('admin'));
adminRouter.get('/users', userController.list);
`,
    );
  } else {
    writeSrc(
      ctx,
      routes,
      `${typeImport(c, `import type { FastifyInstance } from 'fastify';\n`)}import { authenticate } from '${relImport(routes, authMw)}';
import { requireRole } from '${relImport(routes, rbac)}';
import * as userController from '${relImport(routes, users)}';
export async function adminRouter(app${t(c, ': FastifyInstance')}) {
  app.get('/users', { preHandler: [authenticate, requireRole('admin')] }, userController.list);
}
`,
    );
  }
  const v1 = p.apiSrc(`routes/v1/${fileName(c, 'index')}`);
  ctx.addRoute({
    name: 'admin',
    importStatement: `import { adminRouter } from '${relImport(v1, routes)}';`,
    mountPath: '/admin',
    routerIdentifier: 'adminRouter',
    order: 80,
  });
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

void isTs;
