import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '../src/core/defaults.js';
import { GenerationEngine } from '../src/core/engine.js';
import { GenerationContext } from '../src/core/context.js';
import { parseFieldDsl, formControlFor, generateCrud } from '../src/generators/make/crud.js';
import { pathExists } from '../src/utils/fs.js';

describe('generation plan', () => {
  it('plans a default fullstack project without writing files', async () => {
    const engine = new GenerationEngine();
    const config = createDefaultConfig('marketplace');
    const destination = join(tmpdir(), 'pern-starter-dry-run-should-not-exist');
    const plan = await engine.plan(config, destination, { dryRun: true });

    expect(plan.files.length).toBeGreaterThan(20);
    expect(plan.files.some((file) => file.path.endsWith('starter.json'))).toBe(true);
    expect(plan.files.some((file) => file.path.includes('apps/api') && file.path.endsWith('app.ts'))).toBe(
      true,
    );
    expect(plan.files.some((file) => file.path.includes('schema.prisma'))).toBe(true);
    expect(plan.files.some((file) => file.path.endsWith('auth.controller.ts'))).toBe(true);
    expect(plan.packages.some((pkg) => pkg.name === 'express')).toBe(true);
    expect(plan.packages.some((pkg) => pkg.name === '@prisma/client')).toBe(true);
    expect(pathExists(destination)).toBe(false);
  });

  it('does not generate a web app for the api preset layout', async () => {
    const engine = new GenerationEngine();
    const config = createDefaultConfig('api-only');
    config.frontend.kind = 'none';
    config.monorepo = 'none';
    config.auth = 'jwt-refresh-token';
    config.cache = 'redis';
    config.queue = 'bullmq';
    config.docker = 'dev';
    const plan = await engine.plan(config, join(tmpdir(), 'api-only'), { dryRun: true });
    expect(plan.files.some((file) => file.path.startsWith('apps/web'))).toBe(false);
    expect(plan.files.some((file) => file.path === 'src/app.ts' || file.path.endsWith('/src/app.ts'))).toBe(
      true,
    );
    expect(plan.dockerServices).toEqual(expect.arrayContaining(['postgres', 'redis']));
  });

  it('includes payment adapters only when selected', async () => {
    const engine = new GenerationEngine();
    const withStripe = createDefaultConfig('pay');
    withStripe.payments = ['stripe'];
    const without = createDefaultConfig('nopay');
    const paid = await engine.plan(withStripe, join(tmpdir(), 'pay'), { dryRun: true });
    const plain = await engine.plan(without, join(tmpdir(), 'nopay'), { dryRun: true });
    expect(paid.files.some((file) => file.path.toLowerCase().includes('stripe'))).toBe(true);
    expect(plain.files.some((file) => file.path.toLowerCase().includes('stripe'))).toBe(false);
  });
});

describe('context idempotency', () => {
  it('does not duplicate packages, env vars, or files', () => {
    const ctx = new GenerationContext(createDefaultConfig('app'), '/tmp/app', true);
    ctx.addPackage({ name: 'express', version: '^4.21.2', workspace: 'api' });
    ctx.addPackage({ name: 'express', version: '^4.21.2', workspace: 'api' });
    ctx.addEnv({
      key: 'PORT',
      example: '4000',
      required: true,
      description: 'port',
      workspace: 'api',
    });
    ctx.addEnv({
      key: 'PORT',
      example: '4000',
      required: true,
      description: 'port',
      workspace: 'api',
    });
    ctx.writeFile('src/app.ts', 'a');
    ctx.writeFile('src/app.ts', 'b');
    expect(ctx.snapshotPackages()).toHaveLength(1);
    expect(ctx.env).toHaveLength(1);
    expect(ctx.files.get('src/app.ts')).toBe('b');
  });
});

describe('CRUD field DSL', () => {
  it('parses required unique relations and maps form controls', () => {
    const fields = parseFieldDsl(
      'name:string|required,slug:string|required|unique,price:decimal|required,status:enum(draft,live),categoryId:uuid|relation:Category,image:file',
    );
    expect(fields).toHaveLength(6);
    expect(fields[0]).toMatchObject({ name: 'name', type: 'string', required: true });
    expect(fields[1]).toMatchObject({ unique: true });
    expect(formControlFor(fields[2]!)).toBe('currency');
    expect(formControlFor(fields[3]!)).toBe('select');
    expect(formControlFor(fields[4]!)).toBe('relation-select');
    expect(formControlFor(fields[5]!)).toBe('upload');
  });

  it('generates api and web layers for a product entity', () => {
    const config = createDefaultConfig('shop');
    const files = generateCrud({
      entity: 'Product',
      fields: parseFieldDsl('name:string|required,price:decimal|required'),
      config,
    });
    expect(files.some((file) => file.path.includes('product'))).toBe(true);
    expect(files.some((file) => /controller|service|route/i.test(file.path))).toBe(true);
  });
});

describe('materialize dry-run safety', () => {
  it('generate({ dryRun: true }) does not create the destination', async () => {
    const engine = new GenerationEngine();
    const dir = await mkdtemp(join(tmpdir(), 'pern-dry-'));
    const destination = join(dir, 'child-app');
    await engine.generate(createDefaultConfig('dry'), destination, { dryRun: true });
    expect(pathExists(destination)).toBe(false);
    const leftover = await readdir(dir);
    expect(leftover).toEqual([]);
  });
});
