import { Command } from 'commander';
import { printBanner } from './banner.js';
import { runArchitectures, runFeatures, runPatterns } from './commands/catalog.js';
import { runConfig } from './commands/config.js';
import { runDoctor } from './commands/doctor.js';
import { runInstall } from './commands/install.js';
import { runList } from './commands/list.js';
import { runMakeCrud, runMakePattern, runMakeScaffold, type MakeCommandOptions } from './commands/make.js';
import { runNew, type NewCommandOptions } from './commands/new.js';
import { runRemove } from './commands/remove.js';
import { runStatus } from './commands/status.js';
import { runUpdate } from './commands/update.js';
import { runValidate } from './commands/validate.js';
import { getCliVersion } from './helpers.js';
import { printFailure } from './print.js';
import { runUi } from './commands/ui.js';

type FlagOptions = { dryRun?: boolean; yes?: boolean; force?: boolean; json?: boolean };

function action(fn: (...args: unknown[]) => Promise<void>) {
  return async (...args: unknown[]) => {
    try {
      await fn(...args);
    } catch (error) {
      printFailure(error);
      process.exitCode = 1;
    }
  };
}

const makeOptions = (command: Command) =>
  command
    .option('--fields <dsl>', 'CRUD field DSL (name:string|required,...)')
    .option('--layers <layers>', 'Layers to generate: api,web or all', 'all')
    .option('--module <module>', 'Target module name')
    .option('--force', 'Overwrite existing files', false)
    .option('--dry-run', 'Print the plan without writing files', false)
    .option('-y, --yes', 'Skip confirmation prompts', false);

export function createProgram(): Command {
  const program = new Command();

  program
    .name('pern-starter')
    .description('Production-ready PERN stack project generator')
    .version(getCliVersion())
    .showHelpAfterError();

  program
    .command('new')
    .argument('<project>', 'Project name')
    .description('Create a new PERN starter project')
    .option('--orm <orm>', 'ORM: prisma|drizzle|typeorm|sequelize|knex|pg')
    .option('--auth <auth>', 'Auth: none|jwt|session|jwt-refresh-token|oauth2')
    .option('--frontend <frontend>', 'Frontend: vite-react|nextjs|none')
    .option('--architecture <architecture>', 'Architecture id')
    .option('--rbac <rbac>', 'RBAC: none|custom|casl|accesscontrol')
    .option('--docker', 'Enable Docker Compose', false)
    .option('--redis', 'Enable Redis', false)
    .option('--config <path>', 'Load starter.yaml or starter.json')
    .option('--dry-run', 'Print the generation plan without writing files', false)
    .option('-y, --yes', 'Skip prompts and auto-add required dependencies', false)
    .option('--force', 'Overwrite an existing destination folder', false)
    .option('--install', 'Run the package manager install after generation', false)
    .option('--preset <preset>', 'Preset: basic|api|saas|ecommerce|enterprise')
    .option('--pm <pm>', 'Package manager: pnpm|npm|yarn|bun')
    .option('--language <language>', 'Language: typescript|javascript')
    .option('--node-version <version>', 'Target Node.js version')
    .action(
      action(async (project: unknown, options: unknown) => {
        await runNew(String(project), options as NewCommandOptions);
      }),
    );

  program.command('list').description('List selected features (or the catalog)').action(action(runList));
  program
    .command('config')
    .description('Print the current starter.json configuration')
    .option('--json', 'Print JSON instead of YAML', false)
    .action(action(async (options: unknown) => runConfig(options as FlagOptions)));
  program.command('validate').description('Validate starter.json').action(action(runValidate));
  program.command('status').description('Show the current project status').action(action(runStatus));
  program.command('doctor').description('Check local tooling and optional services').action(action(runDoctor));
  program.command('update').description('Show the installed CLI version and how to upgrade').action(action(runUpdate));

  program
    .command('install')
    .argument('<feature>', 'Feature id (stripe, redis, cache-redis, ...)')
    .description('Install a feature into the current generated project')
    .option('--dry-run', 'Print the plan without writing files', false)
    .option('-y, --yes', 'Skip confirmation and auto-add dependencies', false)
    .option('--force', 'Overwrite existing files', false)
    .action(action(async (feature: unknown, options: unknown) => runInstall(String(feature), options as FlagOptions)));

  program
    .command('remove')
    .argument('<feature>', 'Feature id to remove')
    .description('Remove a feature from the current generated project')
    .option('--dry-run', 'Print the plan without writing files', false)
    .option('-y, --yes', 'Skip confirmation', false)
    .option('--force', 'Delete customized files too', false)
    .action(action(async (feature: unknown, options: unknown) => runRemove(String(feature), options as FlagOptions)));

  makeOptions(
    program
      .command('make:crud')
      .argument('<Entity>', 'Entity name, e.g. Product')
      .description('Generate CRUD for an entity'),
  ).action(action(async (entity: unknown, options: unknown) => runMakeCrud(String(entity), options as MakeCommandOptions)));

  const scaffolds: Array<[string, string]> = [
    ['make:module', 'Generate a feature module'],
    ['make:controller', 'Generate a controller'],
    ['make:service', 'Generate a service'],
    ['make:repository', 'Generate a repository'],
    ['make:usecase', 'Generate a use case'],
    ['make:dto', 'Generate a DTO'],
    ['make:schema', 'Generate a validation schema'],
    ['make:middleware', 'Generate middleware'],
    ['make:policy', 'Generate an authorization policy'],
    ['make:validator', 'Generate a validator'],
    ['make:route', 'Generate a route'],
    ['make:event', 'Generate a domain event'],
    ['make:job', 'Generate a background job'],
    ['make:worker', 'Generate a worker'],
    ['make:component', 'Generate a React component'],
    ['make:page', 'Generate a frontend page'],
    ['make:hook', 'Generate a React hook'],
    ['make:store', 'Generate a client store'],
  ];

  for (const [name, description] of scaffolds) {
    const kind = name.slice('make:'.length);
    makeOptions(
      program.command(name).argument('<Name>', 'Name').description(description),
    ).action(
      action(async (value: unknown, options: unknown) =>
        runMakeScaffold(kind, String(value), options as MakeCommandOptions),
      ),
    );
  }

  makeOptions(
    program
      .command('make:pattern')
      .argument('<Pattern>', 'Pattern id, e.g. factory')
      .argument('<Name>', 'Implementation name')
      .description('Generate a sample design-pattern implementation'),
  ).action(
    action(async (pattern: unknown, name: unknown, options: unknown) =>
      runMakePattern(String(pattern), String(name), options as MakeCommandOptions),
    ),
  );

  program.command('ui').description('Open the Vite configurator in the browser').action(action(runUi));
  program.command('patterns').description('List design patterns').action(action(runPatterns));
  program.command('architectures').description('List architectures').action(action(runArchitectures));
  program.command('features').description('List installable features').action(action(runFeatures));

  program.hook('preAction', (thisCommand) => {
    if (thisCommand.name() === 'pern-starter' && thisCommand.args.length === 0) {
      printBanner();
    }
  });

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  process.on('SIGINT', () => {
    process.exit(0);
  });

  const program = createProgram();
  try {
    await program.parseAsync(argv);
  } catch (error) {
    printFailure(error);
    process.exitCode = 1;
  }
}

void main();
