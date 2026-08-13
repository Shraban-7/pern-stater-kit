import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { stringify as stringifyYaml } from 'yaml';
import { createDefaultConfig } from '../src/core/defaults.js';
import { loadConfigFile } from '../src/core/config.js';
import { writeFileEnsured } from '../src/utils/fs.js';
import { TemplateEngine } from '../src/templates/engine.js';
import { pascalCase, kebabCase, pluralize } from '../src/utils/naming.js';
import { renderPlan } from '../src/core/plan-render.js';
import { resolveOverwrite } from '../src/core/overwrite.js';
import { generatePattern } from '../src/generators/make/pattern.js';
import { generateModule } from '../src/generators/make/scaffold.js';

describe('template engine', () => {
  it('renders handlebars helpers', () => {
    const engine = new TemplateEngine();
    const result = engine.render('{{pascalCase name}} {{kebabCase name}}', { name: 'order_item' });
    expect(result).toBe('OrderItem order-item');
  });
});

describe('naming', () => {
  it('pluralizes and cases entity names', () => {
    expect(pascalCase('order-item')).toBe('OrderItem');
    expect(kebabCase('OrderItem')).toBe('order-item');
    expect(pluralize('category')).toBe('categories');
    expect(pluralize('bus')).toBe('buses');
  });
});

describe('yaml config', () => {
  it('loads a starter.yaml document', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pern-yaml-'));
    const file = join(dir, 'starter.yaml');
    const config = createDefaultConfig('from-yaml');
    await writeFileEnsured(file, stringifyYaml(config));
    const loaded = await loadConfigFile(file);
    expect(loaded.name).toBe('from-yaml');
    expect(parseYaml(await readFile(file, 'utf8')).orm).toBe('prisma');
  });
});

describe('overwrite protection', () => {
  it('never silently replaces existing files', () => {
    expect(resolveOverwrite(true, false)).toBe('cancel');
    expect(resolveOverwrite(true, true)).toBe('replace');
    expect(resolveOverwrite(false, false)).toBe('replace');
  });
});

describe('plan rendering', () => {
  it('lists files and packages', () => {
    const text = renderPlan({
      projectName: 'demo',
      destination: '/tmp/demo',
      files: [{ path: 'src/app.ts', contents: '', action: 'create' }],
      packages: [{ name: 'express', version: '^4.21.2', workspace: 'api' }],
      env: [],
      dockerServices: ['postgres'],
      scripts: {},
      features: ['backend-express'],
      warnings: [],
      notes: [],
    });
    expect(text).toContain('+ src/app.ts');
    expect(text).toContain('+ express@^4.21.2');
  });
});

describe('make generators', () => {
  it('make:module follows modular monolith folders', () => {
    const config = createDefaultConfig('shop');
    const files = generateModule('Inventory', config);
    expect(files.some((file) => file.path.includes('modules/inventory'))).toBe(true);
  });

  it('make:pattern writes a factory sample', () => {
    const config = createDefaultConfig('shop');
    const files = generatePattern({ pattern: 'factory', name: 'Payment', config });
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]?.contents).toMatch(/createPayment|PaymentFactory|function create/i);
  });
});
