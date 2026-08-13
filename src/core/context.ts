import type {
  EnvDefinition,
  GenerationContextLike,
  MiddlewareRegistration,
  PlannedPackage,
  RouteRegistration,
  StarterConfig,
  ValidationIssue,
} from './types.js';
import { uniqueBy } from '../utils/merge.js';

export class GenerationContext implements GenerationContextLike {
  readonly files = new Map<string, string>();
  packages: PlannedPackage[] = [];
  env: EnvDefinition[] = [];
  dockerServices = new Set<string>();
  scripts: Record<string, string> = {};
  notes: string[] = [];
  warnings: ValidationIssue[] = [];
  middlewares: MiddlewareRegistration[] = [];
  routes: RouteRegistration[] = [];
  prismaModels: string[] = [];
  prismaEnums: string[] = [];

  constructor(
    readonly config: StarterConfig,
    readonly destination: string,
    readonly dryRun: boolean,
  ) {}

  writeFile(relativePath: string, contents: string): void {
    const normalized = relativePath.replaceAll('\\', '/').replace(/^\.\//, '');
    this.files.set(normalized, contents);
  }

  addPackage(pkg: PlannedPackage): void {
    const existing = this.packages.find(
      (item) => item.name === pkg.name && item.workspace === pkg.workspace,
    );
    if (existing) {
      existing.version = pkg.version;
      existing.dev = pkg.dev;
      return;
    }
    this.packages.push(pkg);
  }

  addEnv(env: EnvDefinition): void {
    if (this.env.some((item) => item.key === env.key && item.workspace === env.workspace)) {
      return;
    }
    this.env.push(env);
  }

  addDockerService(name: string): void {
    this.dockerServices.add(name);
  }

  addScript(name: string, command: string): void {
    this.scripts[name] = command;
  }

  addMiddleware(registration: MiddlewareRegistration): void {
    if (this.middlewares.some((item) => item.name === registration.name)) return;
    this.middlewares.push(registration);
  }

  addRoute(registration: RouteRegistration): void {
    if (this.routes.some((item) => item.name === registration.name)) return;
    this.routes.push(registration);
  }

  addPrismaModel(source: string): void {
    if (this.prismaModels.includes(source)) return;
    this.prismaModels.push(source);
  }

  addPrismaEnum(source: string): void {
    if (this.prismaEnums.includes(source)) return;
    this.prismaEnums.push(source);
  }

  addNote(note: string): void {
    if (!this.notes.includes(note)) this.notes.push(note);
  }

  warn(issue: ValidationIssue): void {
    this.warnings.push(issue);
  }

  snapshotPackages(): PlannedPackage[] {
    return uniqueBy(this.packages, (pkg) => `${pkg.workspace}:${pkg.name}`);
  }
}
