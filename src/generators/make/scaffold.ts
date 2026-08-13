import type { LogicalArea } from '../../core/paths.js';
import { pathsFor } from '../../core/paths.js';
import type { PlannedFile, StarterConfig } from '../../core/types.js';
import { camelCase, kebabCase, pascalCase } from '../../utils/naming.js';
import { t } from '../helpers.js';

export type ScaffoldKind =
  | 'module'
  | 'controller'
  | 'service'
  | 'repository'
  | 'usecase'
  | 'dto'
  | 'schema'
  | 'middleware'
  | 'policy'
  | 'validator'
  | 'route'
  | 'event'
  | 'job'
  | 'worker'
  | 'component'
  | 'page'
  | 'hook'
  | 'store';

export interface GenerateScaffoldOptions {
  kind: ScaffoldKind;
  name: string;
  config: StarterConfig;
  module?: string;
}

const AREA_BY_KIND: Partial<Record<ScaffoldKind, LogicalArea>> = {
  controller: 'controllers',
  service: 'services',
  repository: 'repositories',
  usecase: 'usecases',
  dto: 'dto',
  schema: 'schemas',
  middleware: 'middleware',
  policy: 'middleware',
  validator: 'schemas',
  route: 'routes',
  event: 'events',
  job: 'jobs',
  worker: 'workers',
};

const FRONTEND_KINDS = new Set<ScaffoldKind>(['component', 'page', 'hook', 'store']);

function file(path: string, contents: string): PlannedFile {
  return { path, contents: contents.endsWith('\n') ? contents : `${contents}\n`, action: 'create' };
}

export function generateScaffold(options: GenerateScaffoldOptions): PlannedFile[] {
  if (options.kind === 'module') {
    return generateModule(options.name, options.config);
  }

  const { name, config, kind } = options;
  const pascal = pascalCase(name);
  const camel = camelCase(name);
  const kebab = kebabCase(name);
  const paths = pathsFor(config);
  const ext = paths.ext;
  const reactExt = paths.reactExt;
  const moduleName = options.module;

  if (FRONTEND_KINDS.has(kind) && config.frontend.kind === 'none') {
    throw new Error(`make:${kind} requires a frontend. This project is API-only.`);
  }

  switch (kind) {
    case 'component':
      return [
        file(
          `${paths.webSrc()}/components/${pascal}.${reactExt}`,
          `export function ${pascal}() {
  return <div>${pascal}</div>;
}

export default ${pascal};
`,
        ),
      ];
    case 'page':
      return [
        file(
          `${paths.webSrc()}/pages/${pascal}Page.${reactExt}`,
          `export function ${pascal}Page() {
  return (
    <main>
      <h1>${pascal}</h1>
    </main>
  );
}

export default ${pascal}Page;
`,
        ),
      ];
    case 'hook':
      return [
        file(
          `${paths.webSrc()}/hooks/use${pascal}.${ext}`,
          `import { useState } from 'react';

export function use${pascal}() {
  const [value, setValue] = useState${t(config, '<unknown>')}(null);
  return { value, setValue };
}
`,
        ),
      ];
    case 'store':
      return [
        file(
          `${paths.webSrc()}/stores/${camel}Store.${ext}`,
          config.frontend.state === 'redux'
            ? `import { createSlice } from '@reduxjs/toolkit';

const ${camel}Slice = createSlice({
  name: '${camel}',
  initialState: { value: null },
  reducers: {
    setValue(state, action) {
      state.value = action.payload;
    },
  },
});

export const { setValue } = ${camel}Slice.actions;
export const ${camel}Reducer = ${camel}Slice.reducer;
`
            : `import { create } from 'zustand';

export const use${pascal}Store = create((set) => ({
  value: null,
  setValue: (value${t(config, ': unknown')}) => set({ value }),
}));
`,
        ),
      ];
    default:
      break;
  }

  const area = AREA_BY_KIND[kind] ?? 'lib';
  const fileName = kind === 'usecase' ? `create-${kebab}` : `${kebab}.${kind === 'route' ? 'routes' : kind}`;
  const path = paths.apiFile(area, fileName, moduleName);

  return [file(path, contentsFor(kind, { pascal, camel, kebab, config, ext }))];
}

export function generateModule(name: string, config: StarterConfig): PlannedFile[] {
  const paths = pathsFor(config);
  const pascal = pascalCase(name);
  const kebab = kebabCase(name);
  const root = paths.moduleRoot(name);
  const ext = paths.ext;
  const arch = config.architecture;

  const folders =
    arch === 'ddd' || arch === 'clean' || arch === 'hexagonal'
      ? dddFolders(root, pascal, kebab, ext, arch)
      : modularFolders(root, pascal, kebab, ext);

  return folders;
}

function modularFolders(root: string, pascal: string, kebab: string, ext: string): PlannedFile[] {
  const areas = [
    'controllers',
    'services',
    'repositories',
    'schemas',
    'routes',
    'types',
    'events',
    'jobs',
    'tests',
  ];
  return [
    file(
      `${root}/index.${ext}`,
      `export * from './controllers/${kebab}.controller.${ext === 'ts' ? 'js' : ext}';
export * from './services/${kebab}.service.${ext === 'ts' ? 'js' : ext}';
export * from './routes/${kebab}.routes.${ext === 'ts' ? 'js' : ext}';
`,
    ),
    ...areas.map((area) =>
      file(
        `${root}/${area}/.gitkeep`,
        '',
      ),
    ),
    file(
      `${root}/types/${kebab}.types.${ext}`,
      `export interface ${pascal} {
  id${ext === 'ts' ? ': string' : ''};
}
`,
    ),
    file(
      `${root}/controllers/${kebab}.controller.${ext}`,
      `export async function list${pascal}s(req, res, next) {
  try {
    void req;
    res.json({ data: [] });
  } catch (error) {
    next(error);
  }
}
`,
    ),
    file(
      `${root}/services/${kebab}.service.${ext}`,
      `export class ${pascal}Service {
  list() {
    return [];
  }
}

export const ${camelCase(pascal)}Service = new ${pascal}Service();
`,
    ),
    file(
      `${root}/repositories/${kebab}.repository.${ext}`,
      `export class ${pascal}Repository {
  findMany() {
    return [];
  }
}

export const ${camelCase(pascal)}Repository = new ${pascal}Repository();
`,
    ),
    file(
      `${root}/routes/${kebab}.routes.${ext}`,
      `import { Router } from 'express';
import { list${pascal}s } from '../controllers/${kebab}.controller.${ext === 'ts' ? 'js' : ext}';

export const ${camelCase(pascal)}Router = Router();
${camelCase(pascal)}Router.get('/', list${pascal}s);
export default ${camelCase(pascal)}Router;
`,
    ),
  ];
}

function dddFolders(
  root: string,
  pascal: string,
  kebab: string,
  ext: string,
  arch: StarterConfig['architecture'],
): PlannedFile[] {
  const js = ext === 'ts' ? 'js' : ext;
  const domainDir = arch === 'ddd' ? 'domain/entities' : 'domain';
  return [
    file(`${root}/index.${ext}`, `export * from './presentation/routes/${kebab}.routes.${js}';\n`),
    file(`${root}/domain/.gitkeep`, ''),
    file(`${root}/application/.gitkeep`, ''),
    file(`${root}/infrastructure/.gitkeep`, ''),
    file(`${root}/presentation/.gitkeep`, ''),
    file(
      `${root}/${domainDir}/${pascal}.${ext}`,
      ext === 'ts'
        ? `export class ${pascal} {
  constructor(public readonly id: string) {}
}
`
        : `export class ${pascal} {
  constructor(id) {
    this.id = id;
  }
}
`,
    ),
    file(
      `${root}/application/use-cases/create-${kebab}.${ext}`,
      `export class Create${pascal} {
  async execute(input${ext === 'ts' ? ': Record<string, unknown>' : ''}) {
    return input;
  }
}
`,
    ),
    file(
      `${root}/application/dto/${kebab}.dto.${ext}`,
      `export interface Create${pascal}Dto {
  id${ext === 'ts' ? '?: string' : ''};
}
`,
    ),
    file(
      `${root}/infrastructure/repositories/${kebab}.repository.${ext}`,
      `export class ${pascal}Repository {
  async findById(id${ext === 'ts' ? ': string' : ''}) {
    void id;
    return null;
  }
}
`,
    ),
    file(
      `${root}/presentation/controllers/${kebab}.controller.${ext}`,
      `import { Create${pascal} } from '../../application/use-cases/create-${kebab}.${js}';

export async function create${pascal}(req, res, next) {
  try {
    const usecase = new Create${pascal}();
    res.status(201).json({ data: await usecase.execute(req.body) });
  } catch (error) {
    next(error);
  }
}
`,
    ),
    file(
      `${root}/presentation/routes/${kebab}.routes.${ext}`,
      `import { Router } from 'express';
import { create${pascal} } from '../controllers/${kebab}.controller.${js}';

export const ${camelCase(pascal)}Router = Router();
${camelCase(pascal)}Router.post('/', create${pascal});
export default ${camelCase(pascal)}Router;
`,
    ),
  ];
}

function contentsFor(
  kind: ScaffoldKind,
  ctx: { pascal: string; camel: string; kebab: string; config: StarterConfig; ext: string },
): string {
  const { pascal, camel, kebab, config } = ctx;

  switch (kind) {
    case 'controller':
      return `export async function get${pascal}(req, res, next) {
  try {
    res.json({ data: { id: req.params.id } });
  } catch (error) {
    next(error);
  }
}
`;
    case 'service':
      return `export class ${pascal}Service {
  execute(input${t(config, ': unknown')}) {
    return input;
  }
}

export const ${camel}Service = new ${pascal}Service();
`;
    case 'repository':
      return `export class ${pascal}Repository {
  async findById(id${t(config, ': string')}) {
    void id;
    return null;
  }
}

export const ${camel}Repository = new ${pascal}Repository();
`;
    case 'usecase':
      return `export class Create${pascal} {
  async execute(input${t(config, ': unknown')}) {
    return input;
  }
}
`;
    case 'dto':
      return `export interface ${pascal}Dto {
  id${t(config, ': string')};
}
`;
    case 'schema':
      return `import { z } from 'zod';

export const ${camel}Schema = z.object({
  id: z.string().uuid().optional(),
});
`;
    case 'middleware':
      return `export function ${camel}Middleware(req, res, next) {
  void res;
  next();
}
`;
    case 'policy':
      return `export function canAccess${pascal}(user${t(config, ': { roles?: string[] } | undefined')}) {
  return Boolean(user?.roles?.includes('admin'));
}
`;
    case 'validator':
      return `import { z } from 'zod';

export const ${camel}Validator = z.object({
  id: z.string().uuid().optional(),
});
`;
    case 'route':
      return `import { Router } from 'express';

export const ${camel}Router = Router();
${camel}Router.get('/', (_req, res) => {
  res.json({ ok: true });
});

export default ${camel}Router;
`;
    case 'event':
      return `export class ${pascal}Event {
  readonly occurredAt = new Date();
  constructor(readonly payload${t(config, ': unknown')}) {}
}
`;
    case 'job':
      return `export async function ${camel}Job(payload${t(config, ': unknown')}) {
  void payload;
}
`;
    case 'worker':
      return `export async function start${pascal}Worker() {
  // Worker loop is registered by the queue provider.
}
`;
    default:
      return `export const ${camel} = '${kebab}';\n`;
  }
}
