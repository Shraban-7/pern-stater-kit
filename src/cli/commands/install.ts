import * as p from '@clack/prompts';
import { GenerationEngine } from '../../core/engine.js';
import { FEATURE_CATALOG } from '../../features/catalog.js';
import { applyFeatureToConfig, featuresFromConfig } from '../../features/selection.js';
import {
  confirmContinue,
  loadProject,
  planDelta,
  printInstallPlan,
  resolveFeatureId,
  resolveMissingDependencies,
  writeManifest,
  writePlannedFiles,
} from '../helpers.js';
import { CliError, ok } from '../print.js';

export async function runInstall(
  featureInput: string,
  options: { dryRun?: boolean; yes?: boolean; force?: boolean } = {},
): Promise<void> {
  const { config, cwd } = await loadProject();
  const featureId = resolveFeatureId(featureInput);
  const feature = FEATURE_CATALOG.find((item) => item.id === featureId);
  if (!feature) {
    throw new CliError(`Unknown feature: ${featureInput}`);
  }

  const selected = featuresFromConfig(config);
  if (selected.includes(featureId)) {
    ok(`${feature.name} is already installed.`);
    return;
  }

  let next = applyFeatureToConfig(config, featureId);
  next = await resolveMissingDependencies(next, { yes: options.yes });

  const engine = new GenerationEngine();
  const validation = engine.validate(next);
  if (!validation.ok) {
    throw Object.assign(new Error(validation.errors[0]?.message ?? 'Invalid configuration'), {
      issues: validation.errors,
    });
  }

  const before = await engine.plan(config, cwd, { dryRun: true, autoAddDependencies: true });
  const after = await engine.plan(next, cwd, { dryRun: true, autoAddDependencies: true });
  const delta = planDelta(before, after);

  if (options.dryRun) {
    printInstallPlan(delta, cwd);
    return;
  }

  printInstallPlan(delta, cwd);
  const confirmed = await confirmContinue('Continue?', options.yes);
  if (!confirmed) {
    p.outro('Cancelled.');
    return;
  }

  const files = [...delta.create, ...delta.modify];
  const result = await writePlannedFiles(files, cwd, { force: options.force });
  await writeManifest(cwd, next);

  ok(`Installed ${feature.name}`);
  if (result.created.length) console.log(`Created ${result.created.length} file(s).`);
  if (result.modified.length) console.log(`Modified ${result.modified.length} file(s).`);
  if (result.skipped.length) {
    console.log(`Skipped ${result.skipped.length} existing file(s). Pass --force to overwrite.`);
  }
  if (delta.packages.length) {
    console.log();
    console.log('Packages to add:');
    for (const pkg of delta.packages) {
      console.log(`+ ${pkg.name}@${pkg.version} (${pkg.workspace}${pkg.dev ? ', dev' : ''})`);
    }
  }
  if (delta.env.length) {
    console.log();
    console.log('Environment variables to add:');
    for (const env of delta.env) {
      console.log(`+ ${env.key}`);
    }
  }
}
