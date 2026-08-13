import * as p from '@clack/prompts';
import type { PatternId } from '../../core/types.js';
import { PATTERN_CATALOG } from '../../patterns/catalog.js';
import {
  generateCrud,
  generatePattern,
  generateScaffold,
  parseFieldDsl,
  type CrudLayer,
  type ScaffoldKind,
} from '../../generators/make/index.js';
import { loadProject, writePlannedFiles } from '../helpers.js';
import { CliError, handleCancel, ok, printDryRun } from '../print.js';

export interface MakeCommandOptions {
  fields?: string;
  layers?: string;
  force?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  module?: string;
}

const SCAFFOLD_KINDS = new Set<ScaffoldKind>([
  'module',
  'controller',
  'service',
  'repository',
  'usecase',
  'dto',
  'schema',
  'middleware',
  'policy',
  'validator',
  'route',
  'event',
  'job',
  'worker',
  'component',
  'page',
  'hook',
  'store',
]);

function parseLayers(value?: string): CrudLayer[] | 'all' {
  if (!value || value === 'all') return 'all';
  const layers = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean) as CrudLayer[];
  const allowed: CrudLayer[] = ['api', 'web'];
  for (const layer of layers) {
    if (!allowed.includes(layer)) {
      throw new CliError(
        `Unknown layer: ${layer}`,
        'Layers must be api, web, or all.',
        'Pass --layers=api,web or --layers=all.',
      );
    }
  }
  return layers.length ? layers : 'all';
}

async function promptFields(entity: string, options: MakeCommandOptions): Promise<string> {
  if (options.fields) return options.fields;
  if (options.yes || !process.stdin.isTTY) {
    return 'name:string|required';
  }
  const answer = await p.text({
    message: `Fields for ${entity} (DSL)`,
    placeholder: 'name:string|required,slug:string|required|unique,price:decimal|required',
    initialValue: 'name:string|required',
  });
  return handleCancel(answer);
}

async function writeAndReport(
  files: ReturnType<typeof generateScaffold>,
  options: MakeCommandOptions,
  cwd: string,
  label: string,
): Promise<void> {
  if (options.dryRun) {
    printDryRun(
      {
        projectName: '',
        destination: cwd,
        files,
        packages: [],
        env: [],
        dockerServices: [],
        scripts: {},
        features: [],
        warnings: [],
        notes: [],
      },
      cwd,
    );
    return;
  }

  const result = await writePlannedFiles(files, cwd, { force: options.force, dryRun: false });
  ok(label);
  if (result.created.length) console.log(`Created ${result.created.length} file(s).`);
  if (result.modified.length) console.log(`Updated ${result.modified.length} file(s).`);
  if (result.skipped.length) {
    console.log(`Skipped ${result.skipped.length} existing file(s). Pass --force to overwrite.`);
  }
}

export async function runMakeCrud(entity: string, options: MakeCommandOptions): Promise<void> {
  const { config, cwd } = await loadProject();
  const dsl = await promptFields(entity, options);
  let fields;
  try {
    fields = parseFieldDsl(dsl);
  } catch (error) {
    throw new CliError(
      'Invalid field DSL',
      error instanceof Error ? error.message : String(error),
      'Example: name:string|required,slug:string|required|unique,price:decimal|required',
    );
  }

  const files = generateCrud({
    entity,
    fields,
    config,
    destination: cwd,
    layers: parseLayers(options.layers),
    module: options.module,
  });

  await writeAndReport(files, options, cwd, `Generated CRUD for ${entity}`);
}

export async function runMakeScaffold(
  kind: string,
  name: string,
  options: MakeCommandOptions,
): Promise<void> {
  const { config, cwd } = await loadProject();
  if (!SCAFFOLD_KINDS.has(kind as ScaffoldKind)) {
    throw new CliError(
      `Unknown generator: make:${kind}`,
      `"${kind}" is not a supported scaffold.`,
      'See `pern-starter --help` for make:* commands.',
    );
  }

  try {
    const files = generateScaffold({
      kind: kind as ScaffoldKind,
      name,
      config,
      module: options.module,
    });
    await writeAndReport(files, options, cwd, `Generated ${kind} ${name}`);
  } catch (error) {
    throw new CliError(
      `Could not generate ${kind}`,
      error instanceof Error ? error.message : String(error),
      'Run this command inside a generated project and check architecture/frontend settings.',
    );
  }
}

export async function runMakePattern(
  pattern: string,
  name: string,
  options: MakeCommandOptions,
): Promise<void> {
  const { config, cwd } = await loadProject();
  const id = pattern.trim().toLowerCase() as PatternId;
  const known = PATTERN_CATALOG.find((item) => item.id === id || item.name.toLowerCase() === id);
  if (!known) {
    throw new CliError(
      `Unknown pattern: ${pattern}`,
      `"${pattern}" is not in the pattern catalog.`,
      'Run `pern-starter patterns` to see available ids.',
    );
  }

  const files = generatePattern({
    pattern: known.id,
    name,
    config,
    module: options.module,
  });
  await writeAndReport(files, options, cwd, `Generated ${known.name} pattern for ${name}`);
}
