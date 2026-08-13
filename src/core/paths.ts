import type { ArchitectureId, StarterConfig } from './types.js';
import { extFor, kebabCase, pascalCase } from '../utils/naming.js';

export type LogicalArea =
  | 'config'
  | 'controllers'
  | 'middleware'
  | 'routes'
  | 'services'
  | 'repositories'
  | 'schemas'
  | 'utils'
  | 'types'
  | 'jobs'
  | 'events'
  | 'domain'
  | 'application'
  | 'infrastructure'
  | 'presentation'
  | 'modules'
  | 'ports'
  | 'adapters'
  | 'usecases'
  | 'dto'
  | 'workers'
  | 'queues'
  | 'listeners'
  | 'errors'
  | 'lib';

export class PathResolver {
  constructor(private readonly config: StarterConfig) {}

  get isMonorepo(): boolean {
    return this.config.frontend.kind !== 'none' || this.config.monorepo !== 'none';
  }

  get apiRoot(): string {
    if (this.config.frontend.kind === 'none' && this.config.monorepo === 'none') {
      return '.';
    }
    return 'apps/api';
  }

  get webRoot(): string {
    return 'apps/web';
  }

  get adminRoot(): string {
    return 'apps/admin';
  }

  get ext(): string {
    return extFor(this.config.language);
  }

  get reactExt(): string {
    return extFor(this.config.language, 'tsx');
  }

  apiSrc(file = ''): string {
    const base = this.apiRoot === '.' ? 'src' : `${this.apiRoot}/src`;
    return file ? `${base}/${file}` : base;
  }

  webSrc(file = ''): string {
    const base = `${this.webRoot}/src`;
    return file ? `${base}/${file}` : base;
  }

  moduleRoot(moduleName: string): string {
    const module = kebabCase(moduleName);
    switch (this.primaryArchitecture()) {
      case 'ddd':
      case 'clean':
      case 'hexagonal':
        return this.apiSrc(`modules/${module}`);
      case 'modular-monolith':
      default:
        return this.apiSrc(`modules/${module}`);
    }
  }

  apiFile(area: LogicalArea, fileName: string, moduleName?: string): string {
    const hasExt = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml)$/i.test(fileName);
    const ext = hasExt ? '' : `.${this.ext}`;
    const file = `${fileName}${ext}`;
    const arch = this.primaryArchitecture();

    if (moduleName) {
      return this.moduleFile(arch, moduleName, area, file);
    }

    return this.flatFile(arch, area, file);
  }

  private primaryArchitecture(): ArchitectureId {
    if (
      this.config.architecture === 'monorepo' ||
      this.config.architecture === 'microservice-ready' ||
      this.config.architecture === 'multi-tenant'
    ) {
      return this.config.architectures.find(
        (item) => !['monorepo', 'microservice-ready', 'multi-tenant'].includes(item),
      ) ?? 'modular-monolith';
    }
    return this.config.architecture;
  }

  private moduleFile(
    arch: ArchitectureId,
    moduleName: string,
    area: LogicalArea,
    file: string,
  ): string {
    const root = this.moduleRoot(moduleName);

    if (arch === 'clean' || arch === 'hexagonal') {
      const map: Partial<Record<LogicalArea, string>> = {
        domain: 'domain',
        controllers: 'presentation/controllers',
        routes: 'presentation/routes',
        middleware: 'presentation/middleware',
        usecases: 'application/use-cases',
        dto: 'application/dto',
        services: 'application/services',
        repositories: 'infrastructure/repositories',
        adapters: 'infrastructure/adapters',
        schemas: 'infrastructure/database',
        ports: 'application/ports',
        types: 'domain/types',
      };
      return `${root}/${map[area] ?? area}/${file}`;
    }

    if (arch === 'ddd') {
      const map: Partial<Record<LogicalArea, string>> = {
        domain: 'domain/entities',
        controllers: 'presentation/controllers',
        routes: 'presentation/routes',
        middleware: 'presentation/middleware',
        usecases: 'application/use-cases',
        dto: 'application/dto',
        services: 'domain/services',
        repositories: 'domain/repositories',
        adapters: 'infrastructure/adapters',
        schemas: 'infrastructure/persistence',
        events: 'domain/events',
        types: 'domain/types',
      };
      return `${root}/${map[area] ?? area}/${file}`;
    }

    return `${root}/${area}/${file}`;
  }

  private flatFile(arch: ArchitectureId, area: LogicalArea, file: string): string {
    if (arch === 'clean' || arch === 'hexagonal') {
      const map: Partial<Record<LogicalArea, string>> = {
        domain: 'domain',
        controllers: 'presentation/controllers',
        routes: 'presentation/routes',
        middleware: 'presentation/middleware',
        usecases: 'application/use-cases',
        dto: 'application/dto',
        services: 'application/services',
        repositories: 'infrastructure/repositories',
        adapters: 'infrastructure/adapters',
        schemas: 'infrastructure/database',
        ports: 'application/ports',
        config: 'config',
        utils: 'shared/utils',
        types: 'shared/types',
        errors: 'shared/errors',
        lib: 'infrastructure',
      };
      return this.apiSrc(`${map[area] ?? area}/${file}`);
    }

    if (arch === 'ddd') {
      const map: Partial<Record<LogicalArea, string>> = {
        controllers: 'presentation/controllers',
        routes: 'presentation/routes',
        middleware: 'presentation/middleware',
        usecases: 'application/use-cases',
        dto: 'application/dto',
        services: 'domain/services',
        repositories: 'domain/repositories',
        schemas: 'infrastructure/persistence',
        events: 'domain/events',
        config: 'config',
        errors: 'shared/errors',
      };
      return this.apiSrc(`${map[area] ?? area}/${file}`);
    }

    return this.apiSrc(`${area}/${file}`);
  }

  entityName(name: string): string {
    return pascalCase(name);
  }
}

export function pathsFor(config: StarterConfig): PathResolver {
  return new PathResolver(config);
}
