import { pathsFor } from '../../core/paths.js';
import type { PatternId, PlannedFile, StarterConfig } from '../../core/types.js';
import { PATTERN_CATALOG } from '../../patterns/catalog.js';
import { camelCase, kebabCase, pascalCase } from '../../utils/naming.js';
import { t } from '../helpers.js';

export interface GeneratePatternOptions {
  pattern: PatternId | string;
  name: string;
  config: StarterConfig;
  module?: string;
}

function file(path: string, contents: string): PlannedFile {
  return { path, contents: contents.endsWith('\n') ? contents : `${contents}\n`, action: 'create' };
}

function patternFolder(pattern: PatternId, config: StarterConfig, moduleName?: string): string {
  const paths = pathsFor(config);
  const area = folderFor(pattern);
  if (moduleName) return `${paths.moduleRoot(moduleName)}/${area}`;
  return paths.apiSrc(area);
}

function folderFor(pattern: PatternId): string {
  switch (pattern) {
    case 'adapter':
    case 'bridge':
    case 'decorator':
    case 'facade':
    case 'proxy':
    case 'composite':
      return 'adapters';
    case 'factory':
    case 'abstract-factory':
    case 'builder':
    case 'prototype':
    case 'singleton':
      return 'factories';
    case 'repository':
      return 'repositories';
    case 'service-layer':
      return 'services';
    case 'use-case':
      return 'usecases';
    case 'dto':
    case 'mapper':
      return 'dto';
    case 'domain-event':
    case 'event-bus':
    case 'observer':
    case 'saga':
      return 'events';
    case 'unit-of-work':
      return 'repositories';
    default:
      return 'patterns';
  }
}

export function generatePattern(options: GeneratePatternOptions): PlannedFile[] {
  const pattern = options.pattern as PatternId;
  const definition = PATTERN_CATALOG.find((item) => item.id === pattern);
  if (!definition) {
    throw new Error(`Unknown pattern: ${options.pattern}`);
  }

  const config = options.config;
  const pascal = pascalCase(options.name);
  const camel = camelCase(options.name);
  const kebab = kebabCase(options.name);
  const folder = patternFolder(pattern, config, options.module);
  const ext = pathsFor(config).ext;
  const fileName = `${kebab}.${pattern}.${ext}`;
  const contents = patternSource(pattern, { pascal, camel, kebab, config, warn: definition.warn });

  const files = [file(`${folder}/${fileName}`, contents)];
  if (definition.warn) {
    files.push(
      file(
        `${folder}/${kebab}.${pattern}.md`,
        `# ${definition.name}\n\n${definition.description}\n\n> ${definition.warn}\n`,
      ),
    );
  }
  return files;
}

function patternSource(
  pattern: PatternId,
  ctx: { pascal: string; camel: string; kebab: string; config: StarterConfig; warn?: string },
): string {
  const { pascal, camel, config } = ctx;
  const T = (ts: string, js = '') => t(config, ts, js);

  switch (pattern) {
    case 'factory':
      return `export interface ${pascal} {
  id${T(': string')};
}

export function create${pascal}(overrides${T(': Partial<' + pascal + '> = {}')}): ${pascal} {
  return { id: crypto.randomUUID(), ...overrides };
}
`;
    case 'abstract-factory':
      return `export interface ${pascal}Product {
  name${T(': string')};
}

export interface ${pascal}Factory {
  create()${T(': ' + pascal + 'Product')};
}

export class Default${pascal}Factory implements ${pascal}Factory {
  create() {
    return { name: '${pascal}' };
  }
}
`;
    case 'builder':
      return `export class ${pascal}Builder {
  constructor(private readonly values${T(': Record<string, unknown>')} = {}) {}

  set(key${T(': string')}, value${T(': unknown')}) {
    return new ${pascal}Builder({ ...this.values, [key]: value });
  }

  build() {
    return this.values;
  }
}
`;
    case 'prototype':
      return `export class ${pascal}Prototype {
  constructor(readonly value${T(': unknown')}) {}

  clone() {
    return new ${pascal}Prototype(structuredClone(this.value));
  }
}
`;
    case 'singleton':
      return `let instance${T(': ' + pascal + ' | undefined')};

export class ${pascal} {
  static getInstance() {
    instance ??= new ${pascal}();
    return instance;
  }

  private constructor() {}
}
`;
    case 'adapter':
      return `export interface ${pascal}Port {
  execute(input${T(': unknown')})${T(': Promise<unknown>')};
}

export class ${pascal}Adapter implements ${pascal}Port {
  constructor(private readonly client${T(': { send: (input: unknown) => Promise<unknown> }')}) {}

  execute(input${T(': unknown')}) {
    return this.client.send(input);
  }
}
`;
    case 'bridge':
      return `export interface ${pascal}Implementation {
  apply(value${T(': string')})${T(': string')};
}

export class ${pascal}Abstraction {
  constructor(private readonly impl${T(': ' + pascal + 'Implementation')}) {}

  run(value${T(': string')}) {
    return this.impl.apply(value);
  }
}
`;
    case 'composite':
      return `export interface ${pascal}Node {
  operation()${T(': string')};
}

export class ${pascal}Leaf implements ${pascal}Node {
  constructor(private readonly value${T(': string')}) {}
  operation() { return this.value; }
}

export class ${pascal}Composite implements ${pascal}Node {
  constructor(private readonly children${T(': ' + pascal + 'Node[]')} = []) {}
  operation() { return this.children.map((child) => child.operation()).join(','); }
}
`;
    case 'decorator':
      return `export function with${pascal}(handler${T(': (input: unknown) => unknown')}) {
  return (input${T(': unknown')}) => handler(input);
}
`;
    case 'facade':
      return `export class ${pascal}Facade {
  async run() {
    return { ok: true };
  }
}
`;
    case 'proxy':
      return `export class ${pascal}Proxy {
  constructor(private readonly target${T(': { execute: (input: unknown) => unknown }')}) {}

  execute(input${T(': unknown')}) {
    return this.target.execute(input);
  }
}
`;
    case 'strategy':
      return `export interface ${pascal}Strategy {
  execute(input${T(': unknown')})${T(': unknown')};
}

export class ${pascal}Context {
  constructor(private strategy${T(': ' + pascal + 'Strategy')}) {}

  setStrategy(strategy${T(': ' + pascal + 'Strategy')}) {
    this.strategy = strategy;
  }

  run(input${T(': unknown')}) {
    return this.strategy.execute(input);
  }
}
`;
    case 'command':
      return `export interface ${pascal}Command {
  execute()${T(': Promise<void> | void')};
}

export class ${pascal}Invoker {
  async run(command${T(': ' + pascal + 'Command')}) {
    await command.execute();
  }
}
`;
    case 'observer':
      return `type ${pascal}Listener = (payload${T(': unknown')}) => void;

export class ${pascal}Subject {
  private readonly listeners${T(': ' + pascal + 'Listener[]')} = [];

  subscribe(listener${T(': ' + pascal + 'Listener')}) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  notify(payload${T(': unknown')}) {
    for (const listener of this.listeners) listener(payload);
  }
}
`;
    case 'state':
      return `export interface ${pascal}State {
  handle(context${T(': ' + pascal + 'Machine')})${T(': void')};
}

export class ${pascal}Machine {
  constructor(private state${T(': ' + pascal + 'State')}) {}
  transition(state${T(': ' + pascal + 'State')}) { this.state = state; }
  handle() { this.state.handle(this); }
}
`;
    case 'chain-of-responsibility':
      return `export abstract class ${pascal}Handler {
  constructor(private next${T(': ' + pascal + 'Handler | undefined')} = undefined) {}

  setNext(handler${T(': ' + pascal + 'Handler')}) {
    this.next = handler;
    return handler;
  }

  handle(request${T(': unknown')})${T(': unknown')} {
    return this.next?.handle(request);
  }
}
`;
    case 'mediator':
      return `export class ${pascal}Mediator {
  notify(sender${T(': string')}, event${T(': string')}) {
    void sender;
    void event;
  }
}
`;
    case 'template-method':
      return `export abstract class ${pascal}Template {
  run() {
    this.stepOne();
    this.stepTwo();
  }

  protected abstract stepOne()${T(': void')};
  protected abstract stepTwo()${T(': void')};
}
`;
    case 'specification':
      return `export interface ${pascal}Specification {
  isSatisfiedBy(candidate${T(': unknown')})${T(': boolean')};
}

export class ${camel}Equals implements ${pascal}Specification {
  constructor(private readonly expected${T(': unknown')}) {}
  isSatisfiedBy(candidate${T(': unknown')}) {
    return candidate === this.expected;
  }
}
`;
    case 'service-layer':
      return `export class ${pascal}Service {
  execute(input${T(': unknown')}) {
    return input;
  }
}
`;
    case 'repository':
      return `export interface ${pascal}Repository {
  findById(id${T(': string')})${T(': Promise<unknown | null>')};
  save(entity${T(': unknown')})${T(': Promise<void>')};
}
`;
    case 'use-case':
      return `export class ${pascal}UseCase {
  async execute(input${T(': unknown')}) {
    return input;
  }
}
`;
    case 'dto':
      return `export interface ${pascal}Dto {
  id${T(': string')};
}
`;
    case 'mapper':
      return `export function to${pascal}Dto(entity${T(': Record<string, unknown>')}) {
  return { id: String(entity.id ?? '') };
}
`;
    case 'unit-of-work':
      return `export class ${pascal}UnitOfWork {
  private readonly work${T(': Array<() => Promise<void>>')} = [];

  register(task${T(': () => Promise<void>')}) {
    this.work.push(task);
  }

  async commit() {
    for (const task of this.work) await task();
    this.work.length = 0;
  }
}
`;
    case 'domain-event':
      return `export class ${pascal}Occurred {
  readonly occurredAt = new Date();
  constructor(readonly payload${T(': unknown')}) {}
}
`;
    case 'event-bus':
      return `type Handler = (event${T(': unknown')}) => void | Promise<void>;

export class ${pascal}EventBus {
  private readonly handlers = new Map${T('<string, Handler[]>')}();

  on(name${T(': string')}, handler${T(': Handler')}) {
    const list = this.handlers.get(name) ?? [];
    list.push(handler);
    this.handlers.set(name, list);
  }

  async emit(name${T(': string')}, event${T(': unknown')}) {
    for (const handler of this.handlers.get(name) ?? []) await handler(event);
  }
}
`;
    case 'saga':
      return `export class ${pascal}Saga {
  async run(steps${T(': Array<() => Promise<void>>')}, compensate${T(': Array<() => Promise<void>>')}) {
    const done${T(': Array<() => Promise<void>>')} = [];
    try {
      for (const step of steps) {
        await step();
        const undo = compensate[done.length];
        if (undo) done.push(undo);
      }
    } catch (error) {
      for (const undo of done.reverse()) await undo();
      throw error;
    }
  }
}
`;
    default:
      return `export const ${camel} = '${pattern}';\n`;
  }
}
