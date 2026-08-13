import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import { createDefaultConfig, loadConfigFile, mergeCliOptions } from '../../core/config.js';
import { GenerationEngine } from '../../core/engine.js';
import type { CliOptions, StarterConfig } from '../../core/types.js';
import { pathExists } from '../../utils/fs.js';
import { printBanner } from '../banner.js';
import { isInteractive, resolveMissingDependencies, runInstall, writeManifest } from '../helpers.js';
import { CliError, printDryRun, printFailure, printGenerationChecklist, printSuccessCreated } from '../print.js';
import { confirmGeneration, runWizard } from '../wizard.js';

export interface NewCommandOptions extends CliOptions {
  pm?: StarterConfig['packageManager'];
}

export async function runNew(project: string, options: NewCommandOptions): Promise<void> {
  printBanner();

  if (!/^[a-zA-Z][a-zA-Z0-9-_]*$/.test(project) && project !== '.') {
    throw new CliError(
      `Invalid project name: ${project}`,
      'Project name must start with a letter and contain only letters, numbers, hyphens, and underscores.',
      'Use a name like marketplace or my-app.',
    );
  }

  const cwd = process.cwd();
  let config: StarterConfig;

  if (options.config) {
    const configPath = resolve(cwd, options.config);
    if (!pathExists(configPath)) {
      throw new CliError(
        `Config file not found: ${options.config}`,
        `No file exists at ${configPath}.`,
        'Pass a valid --config path to starter.yaml or starter.json.',
      );
    }
    config = await loadConfigFile(configPath);
    config.name = project === '.' ? config.name : project;
  } else {
    config = createDefaultConfig(project);
  }

  const cliOptions: CliOptions = {
    ...options,
    packageManager: options.pm ?? options.packageManager,
  };

  config = mergeCliOptions(config, cliOptions);

  const useWizard = isInteractive(options.yes) && !options.config;
  if (useWizard) {
    config = await runWizard({ name: project, defaults: config });
  } else {
    config.name = project === '.' ? config.name : project;
  }

  config = await resolveMissingDependencies(config, { yes: options.yes });

  const engine = new GenerationEngine();
  const validation = engine.validate(config);
  if (!validation.ok) {
    throw Object.assign(new Error(validation.errors[0]?.message ?? 'Invalid configuration'), {
      issues: validation.errors,
    });
  }
  for (const warning of validation.warnings) {
    p.log.warn(warning.message);
  }

  const destination = resolve(cwd, project);
  if (options.dryRun) {
    const plan = await engine.plan(config, destination, {
      dryRun: true,
      autoAddDependencies: Boolean(options.yes),
    });
    printDryRun(plan, destination);
    return;
  }

  const confirmed = await confirmGeneration(config, options.yes);
  if (!confirmed) {
    p.outro('Cancelled.');
    return;
  }

  const spin = p.spinner();
  spin.start('Generating project');
  try {
    await engine.generate(config, destination, {
      dryRun: false,
      force: options.force,
      autoAddDependencies: Boolean(options.yes),
    });
  } catch (error) {
    spin.stop('Generation failed');
    throw error;
  }
  spin.stop('Project generated');

  if (!pathExists(resolve(destination, 'starter.json'))) {
    await writeManifest(destination, config);
  }

  console.log();
  printGenerationChecklist(config);
  printSuccessCreated(config, project);

  if (options.install) {
    const installSpin = p.spinner();
    installSpin.start(`Installing dependencies with ${config.packageManager}`);
    try {
      await runInstall(config.packageManager, destination);
      installSpin.stop('Dependencies installed');
    } catch (error) {
      installSpin.stop('Dependency install failed');
      printFailure(error);
    }
  }
}
