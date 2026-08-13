import type { PlannedFile, StarterConfig } from '../../core/types.js';
import { pathsFor } from '../../core/paths.js';
import { camelCase, kebabCase, pascalCase, pluralize, snakeCase } from '../../utils/naming.js';
import { t } from '../helpers.js';

export type CrudFieldType =
  | 'string'
  | 'text'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'enum'
  | 'uuid'
  | 'file'
  | 'json';

export interface CrudField {
  name: string;
  type: CrudFieldType;
  required: boolean;
  unique: boolean;
  relation?: string;
  enumValues?: string[];
}

export type CrudLayer = 'api' | 'web';

export interface GenerateCrudOptions {
  entity: string;
  fields: CrudField[];
  config: StarterConfig;
  destination?: string;
  layers?: CrudLayer[] | 'all';
  module?: string;
}

export const FORM_CONTROL_MAP: Record<CrudFieldType, string> = {
  string: 'text',
  text: 'textarea',
  integer: 'number',
  decimal: 'currency',
  boolean: 'switch',
  date: 'datepicker',
  datetime: 'datetime',
  enum: 'select',
  uuid: 'text',
  file: 'upload',
  json: 'json-editor',
};

export function formControlFor(field: CrudField): string {
  if (field.type === 'uuid' && field.relation) return 'relation-select';
  return FORM_CONTROL_MAP[field.type] ?? 'text';
}

const FIELD_TYPES = new Set<CrudFieldType>([
  'string',
  'text',
  'integer',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'enum',
  'uuid',
  'file',
  'json',
]);

function normalizeType(raw: string): CrudFieldType {
  const value = raw.trim().toLowerCase();
  if (value === 'int' || value === 'number') return 'integer';
  if (value === 'float' || value === 'money' || value === 'currency') return 'decimal';
  if (value === 'bool') return 'boolean';
  if (value === 'timestamp') return 'datetime';
  if (value === 'relation') return 'uuid';
  if (FIELD_TYPES.has(value as CrudFieldType)) return value as CrudFieldType;
  return 'string';
}

function splitFieldDsl(dsl: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const ch of dsl) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export function parseFieldDsl(dsl: string): CrudField[] {
  if (!dsl.trim()) return [];
  return splitFieldDsl(dsl).map((part) => {
      const tokens = part.split('|').map((token) => token.trim()).filter(Boolean);
      const [nameType, ...mods] = tokens;
      if (!nameType) {
        throw new Error(`Invalid field DSL segment: ${part}`);
      }
      const colon = nameType.indexOf(':');
      const name = colon === -1 ? nameType : nameType.slice(0, colon).trim();
      const typeRaw = colon === -1 ? 'string' : nameType.slice(colon + 1).trim();
      if (!name) throw new Error(`Field name is required in: ${part}`);
      const enumInline = typeRaw.match(/^enum\((.+)\)$/i);
      const type = normalizeType(enumInline ? 'enum' : typeRaw);
      const field: CrudField = { name: camelCase(name), type, required: false, unique: false };
      if (enumInline?.[1]) {
        field.enumValues = enumInline[1].split(',').map((item) => item.trim()).filter(Boolean);
      }
      for (const mod of mods) {
        if (mod === 'required') field.required = true;
        else if (mod === 'unique') field.unique = true;
        else if (mod === 'optional') field.required = false;
        else if (mod.startsWith('relation:')) field.relation = pascalCase(mod.slice('relation:'.length));
        else if (mod.startsWith('values:')) {
          field.enumValues = mod
            .slice('values:'.length)
            .split(/[+|]/)
            .map((item) => item.trim())
            .filter(Boolean);
        } else if (type === 'enum') {
          field.enumValues = [...(field.enumValues ?? []), mod];
        }
      }
      if (type === 'enum' && !field.enumValues?.length) {
        field.enumValues = ['ACTIVE', 'INACTIVE'];
      }
      return field;
    });
}

function names(entity: string) {
  const pascal = pascalCase(entity);
  const camel = camelCase(entity);
  const kebab = kebabCase(entity);
  const snake = snakeCase(entity);
  const plural = pluralize(camel);
  const pluralKebab = kebabCase(pluralize(pascal));
  const table = snakeCase(pluralize(pascal));
  return { pascal, camel, kebab, snake, plural, pluralKebab, table };
}

function prismaType(field: CrudField): string {
  switch (field.type) {
    case 'integer':
      return 'Int';
    case 'decimal':
      return 'Decimal @db.Decimal(10, 2)';
    case 'boolean':
      return 'Boolean';
    case 'date':
      return 'DateTime @db.Date';
    case 'datetime':
      return 'DateTime';
    case 'json':
      return 'Json';
    case 'text':
      return 'String @db.Text';
    case 'enum':
      return pascalCase(field.name);
    case 'uuid':
      return 'String @db.Uuid';
    default:
      return 'String';
  }
}

function tsType(field: CrudField): string {
  switch (field.type) {
    case 'integer':
    case 'decimal':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
    case 'datetime':
      return 'Date | string';
    case 'json':
      return 'Record<string, unknown>';
    case 'enum':
      return (field.enumValues ?? ['ACTIVE', 'INACTIVE']).map((value) => `'${value}'`).join(' | ');
    default:
      return 'string';
  }
}

function zodCheck(field: CrudField): string {
  switch (field.type) {
    case 'integer':
      return 'z.number().int()';
    case 'decimal':
      return 'z.number()';
    case 'boolean':
      return 'z.boolean()';
    case 'date':
    case 'datetime':
      return 'z.coerce.date()';
    case 'json':
      return 'z.record(z.unknown())';
    case 'enum':
      return `z.enum([${(field.enumValues ?? ['ACTIVE', 'INACTIVE']).map((value) => `'${value}'`).join(', ')}])`;
    case 'uuid':
      return 'z.string().uuid()';
    case 'text':
      return 'z.string().min(1)';
    default:
      return field.required ? 'z.string().min(1)' : 'z.string()';
  }
}

function drizzleColumn(field: CrudField): string {
  const col = snakeCase(field.name);
  switch (field.type) {
    case 'integer':
      return `integer('${col}')`;
    case 'decimal':
      return `numeric('${col}', { precision: 10, scale: 2 })`;
    case 'boolean':
      return `boolean('${col}')`;
    case 'date':
      return `date('${col}')`;
    case 'datetime':
      return `timestamp('${col}', { withTimezone: true })`;
    case 'json':
      return `jsonb('${col}')`;
    case 'text':
      return `text('${col}')`;
    default:
      return `varchar('${col}', { length: 255 })`;
  }
}

function file(path: string, contents: string): PlannedFile {
  return { path, contents: contents.endsWith('\n') ? contents : `${contents}\n`, action: 'create' };
}

export function generateCrud(options: GenerateCrudOptions): PlannedFile[] {
  const { entity, config } = options;
  const fields = options.fields.length
    ? options.fields
    : [{ name: 'name', type: 'string' as const, required: true, unique: false }];
  const n = names(entity);
  const moduleName = options.module ?? n.pascal;
  const paths = pathsFor(config);
  const ext = paths.ext;
  const reactExt = paths.reactExt;
  const layers = options.layers === 'all' || !options.layers ? (['api', 'web'] as CrudLayer[]) : options.layers;
  const includeApi = layers.includes('api');
  const includeWeb = layers.includes('web') && config.frontend.kind !== 'none';
  const files: PlannedFile[] = [];

  const fieldProps = fields
    .map((field) => `  ${field.name}${field.required ? '' : '?'}${t(config, `: ${tsType(field)}`)};`)
    .join('\n');

  if (includeApi) {
    files.push(
      file(
        paths.apiFile('types', `${n.kebab}.types`, moduleName),
        `export interface ${n.pascal} {
  id${t(config, ': string')};
${fieldProps}
  createdAt${t(config, ': Date | string')};
  updatedAt${t(config, ': Date | string')};
}

export interface Create${n.pascal}Input {
${fieldProps}
}

export interface Update${n.pascal}Input {
${fields.map((field) => `  ${field.name}?${t(config, `: ${tsType(field)}`)};`).join('\n')}
}
`,
      ),
    );

    files.push(
      file(
        paths.apiFile('dto', `${n.kebab}.dto`, moduleName),
        `import type { Create${n.pascal}Input, Update${n.pascal}Input } from '../types/${n.kebab}.types${ext === 'ts' ? '.js' : ''}';

export type Create${n.pascal}Dto = Create${n.pascal}Input;
export type Update${n.pascal}Dto = Update${n.pascal}Input;
`,
      ),
    );

    const zodFields = fields
      .map((field) => {
        let check = zodCheck(field);
        if (!field.required) check = `${check}.optional()`;
        return `  ${field.name}: ${check},`;
      })
      .join('\n');

    files.push(
      file(
        paths.apiFile('schemas', `${n.kebab}.validation`, moduleName),
        `import { z } from 'zod';

export const create${n.pascal}Schema = z.object({
${zodFields}
});

export const update${n.pascal}Schema = create${n.pascal}Schema.partial();
`,
      ),
    );

    files.push(file(schemaPath(config, n, moduleName), schemaContents(config, n, fields)));
    files.push(
      file(
        migrationPath(config, n),
        sqlMigration(n, fields),
      ),
    );

    files.push(
      file(
        paths.apiFile('repositories', `${n.kebab}.repository`, moduleName),
        `import type { Create${n.pascal}Input, Update${n.pascal}Input, ${n.pascal} } from '../types/${n.kebab}.types${ext === 'ts' ? '.js' : ''}';

export class ${n.pascal}Repository {
  async findMany()${t(config, ': Promise<' + n.pascal + '[]>')} {
    return []${t(config, ' as ' + n.pascal + '[]')};
  }

  async findById(id${t(config, ': string')})${t(config, ': Promise<' + n.pascal + ' | null>')} {
    void id;
    return null;
  }

  async create(input${t(config, ': Create' + n.pascal + 'Input')})${t(config, ': Promise<' + n.pascal + '>')} {
    return { id: crypto.randomUUID(), ...input, createdAt: new Date(), updatedAt: new Date() };
  }

  async update(id${t(config, ': string')}, input${t(config, ': Update' + n.pascal + 'Input')})${t(config, ': Promise<' + n.pascal + ' | null>')} {
    void id;
    void input;
    return null;
  }

  async delete(id${t(config, ': string')})${t(config, ': Promise<boolean>')} {
    void id;
    return false;
  }
}

export const ${n.camel}Repository = new ${n.pascal}Repository();
`,
      ),
    );

    files.push(
      file(
        paths.apiFile('services', `${n.kebab}.service`, moduleName),
        `import { ${n.camel}Repository } from '../repositories/${n.kebab}.repository${ext === 'ts' ? '.js' : ''}';
import type { Create${n.pascal}Input, Update${n.pascal}Input } from '../types/${n.kebab}.types${ext === 'ts' ? '.js' : ''}';

export class ${n.pascal}Service {
  list() {
    return ${n.camel}Repository.findMany();
  }

  get(id${t(config, ': string')}) {
    return ${n.camel}Repository.findById(id);
  }

  create(input${t(config, ': Create' + n.pascal + 'Input')}) {
    return ${n.camel}Repository.create(input);
  }

  update(id${t(config, ': string')}, input${t(config, ': Update' + n.pascal + 'Input')}) {
    return ${n.camel}Repository.update(id, input);
  }

  remove(id${t(config, ': string')}) {
    return ${n.camel}Repository.delete(id);
  }
}

export const ${n.camel}Service = new ${n.pascal}Service();
`,
      ),
    );

    files.push(
      file(
        paths.apiFile('controllers', `${n.kebab}.controller`, moduleName),
        `import { ${n.camel}Service } from '../services/${n.kebab}.service${ext === 'ts' ? '.js' : ''}';

export async function list${n.pascal}s(req, res, next) {
  try {
    void req;
    res.json({ data: await ${n.camel}Service.list() });
  } catch (error) {
    next(error);
  }
}

export async function get${n.pascal}(req, res, next) {
  try {
    const item = await ${n.camel}Service.get(req.params.id);
    if (!item) return res.status(404).json({ error: { message: '${n.pascal} not found' } });
    res.json({ data: item });
  } catch (error) {
    next(error);
  }
}

export async function create${n.pascal}(req, res, next) {
  try {
    const item = await ${n.camel}Service.create(req.body);
    res.status(201).json({ data: item });
  } catch (error) {
    next(error);
  }
}

export async function update${n.pascal}(req, res, next) {
  try {
    const item = await ${n.camel}Service.update(req.params.id, req.body);
    if (!item) return res.status(404).json({ error: { message: '${n.pascal} not found' } });
    res.json({ data: item });
  } catch (error) {
    next(error);
  }
}

export async function delete${n.pascal}(req, res, next) {
  try {
    await ${n.camel}Service.remove(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
`,
      ),
    );

    files.push(
      file(
        paths.apiFile('routes', `${n.kebab}.routes`, moduleName),
        `import { Router } from 'express';
import {
  create${n.pascal},
  delete${n.pascal},
  get${n.pascal},
  list${n.pascal}s,
  update${n.pascal},
} from '../controllers/${n.kebab}.controller${ext === 'ts' ? '.js' : ''}';

export const ${n.camel}Router = Router();

${n.camel}Router.get('/', list${n.pascal}s);
${n.camel}Router.get('/:id', get${n.pascal});
${n.camel}Router.post('/', create${n.pascal});
${n.camel}Router.patch('/:id', update${n.pascal});
${n.camel}Router.delete('/:id', delete${n.pascal});

export default ${n.camel}Router;
`,
      ),
    );

    files.push(
      file(
        `${paths.moduleRoot(moduleName)}/tests/${n.kebab}.test.${ext}`,
        `import { describe, expect, it } from 'vitest';
import { ${n.pascal}Service } from '../services/${n.kebab}.service${ext === 'ts' ? '.js' : ''}';

describe('${n.pascal}Service', () => {
  it('lists ${n.plural}', async () => {
    const service = new ${n.pascal}Service();
    const result = await service.list();
    expect(Array.isArray(result)).toBe(true);
  });
});
`,
      ),
    );
  }

  if (includeWeb) {
    const formFields = fields
      .map((field) => {
        const control = formControlFor(field);
        return `      <label>
        ${field.name}
        <input name="${field.name}" data-control="${control}" ${field.required ? 'required' : ''} />
      </label>`;
      })
      .join('\n');

    files.push(
      file(
        `${paths.webSrc()}/api/${n.pluralKebab}.${ext}`,
        `const baseUrl = '/api/${n.pluralKebab}';

export async function list${n.pascal}s() {
  const response = await fetch(baseUrl);
  return response.json();
}

export async function get${n.pascal}(id${t(config, ': string')}) {
  const response = await fetch(\`\${baseUrl}/\${id}\`);
  return response.json();
}

export async function create${n.pascal}(input${t(config, ': Record<string, unknown>')}) {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return response.json();
}
`,
      ),
    );

    files.push(
      file(
        `${paths.webSrc()}/components/${n.pascal}Form.${reactExt}`,
        `export function ${n.pascal}Form({ onSubmit }${t(config, ': { onSubmit: (values: Record<string, unknown>) => void }')}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget).entries());
        onSubmit(data);
      }}
    >
${formFields}
      <button type="submit">Save ${n.pascal}</button>
    </form>
  );
}
`,
      ),
    );

    files.push(
      file(
        `${paths.webSrc()}/components/${n.pascal}Table.${reactExt}`,
        `export function ${n.pascal}Table({ rows }${t(config, ': { rows: Array<Record<string, unknown>> }')}) {
  const columns = ${JSON.stringify(['id', ...fields.map((field) => field.name)])};
  return (
    <table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={String(row.id)}>
            {columns.map((column) => (
              <td key={column}>{String(row[column] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
`,
      ),
    );

    files.push(
      file(
        `${paths.webSrc()}/pages/${n.pascal}sPage.${reactExt}`,
        `import { ${n.pascal}Form } from '../components/${n.pascal}Form${reactExt === 'tsx' ? '' : ''}';
import { ${n.pascal}Table } from '../components/${n.pascal}Table${reactExt === 'tsx' ? '' : ''}';

export function ${n.pascal}sPage() {
  return (
    <main>
      <h1>${n.pascal}s</h1>
      <${n.pascal}Form onSubmit={() => undefined} />
      <${n.pascal}Table rows={[]} />
    </main>
  );
}

export default ${n.pascal}sPage;
`,
      ),
    );
  }

  return files;
}

function schemaPath(config: StarterConfig, n: ReturnType<typeof names>, moduleName: string): string {
  const paths = pathsFor(config);
  if (config.orm === 'prisma') {
    return `${paths.apiRoot === '.' ? 'prisma' : `${paths.apiRoot}/prisma`}/models/${n.kebab}.prisma`;
  }
  if (config.orm === 'drizzle') {
    return paths.apiSrc(`db/${n.kebab}.${paths.ext}`);
  }
  return paths.apiFile('schemas', `${n.kebab}.schema`, moduleName);
}

function schemaContents(
  config: StarterConfig,
  n: ReturnType<typeof names>,
  fields: CrudField[],
): string {
  if (config.orm === 'prisma') {
    const enums = fields
      .filter((field) => field.type === 'enum')
      .map((field) => {
        const values = (field.enumValues ?? ['ACTIVE', 'INACTIVE']).join('\n  ');
        return `enum ${pascalCase(field.name)} {\n  ${values}\n}`;
      })
      .join('\n\n');
    const cols = fields
      .map((field) => {
        const optional = field.required ? '' : '?';
        const unique = field.unique ? ' @unique' : '';
        return `  ${field.name} ${prismaType(field)}${optional}${unique}`;
      })
      .join('\n');
    return `${enums}${enums ? '\n\n' : ''}model ${n.pascal} {
  id        String   @id @default(uuid())
${cols}
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("${n.table}")
}
`;
  }

  if (config.orm === 'drizzle') {
    const cols = fields
      .map((field) => {
        const extra = [
          field.required ? '.notNull()' : '',
          field.unique ? '.unique()' : '',
        ].join('');
        return `  ${field.name}: ${drizzleColumn(field)}${extra},`;
      })
      .join('\n');
    return `import { pgTable, timestamp, uuid, varchar, integer, boolean, numeric, date, text, jsonb } from 'drizzle-orm/pg-core';

export const ${n.camel}s = pgTable('${n.table}', {
  id: uuid('id').primaryKey().defaultRandom(),
${cols}
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
`;
  }

  return `export const ${n.camel}Schema = {
  table: '${n.table}',
  fields: ${JSON.stringify(fields, null, 2)},
};
`;
}

function migrationPath(config: StarterConfig, n: ReturnType<typeof names>): string {
  const paths = pathsFor(config);
  const stamp = '0001';
  const root = paths.apiRoot === '.' ? 'prisma' : `${paths.apiRoot}/prisma`;
  if (config.orm === 'prisma') return `${root}/migrations/${stamp}_create_${n.table}/migration.sql`;
  return `${paths.apiSrc()}/database/migrations/${stamp}_create_${n.table}.sql`;
}

function sqlMigration(n: ReturnType<typeof names>, fields: CrudField[]): string {
  const cols = fields
    .map((field) => {
      const sqlType = sqlTypeFor(field);
      const nullability = field.required ? ' NOT NULL' : '';
      const unique = field.unique ? ' UNIQUE' : '';
      return `  "${snakeCase(field.name)}" ${sqlType}${nullability}${unique}`;
    })
    .join(',\n');
  return `CREATE TABLE "${n.table}" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
${cols},
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
}

function sqlTypeFor(field: CrudField): string {
  switch (field.type) {
    case 'integer':
      return 'INTEGER';
    case 'decimal':
      return 'NUMERIC(10, 2)';
    case 'boolean':
      return 'BOOLEAN';
    case 'date':
      return 'DATE';
    case 'datetime':
      return 'TIMESTAMPTZ';
    case 'json':
      return 'JSONB';
    case 'text':
      return 'TEXT';
    case 'uuid':
      return 'UUID';
    default:
      return 'TEXT';
  }
}
