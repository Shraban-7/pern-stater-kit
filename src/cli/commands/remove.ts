import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as p from '@clack/prompts';
import { GenerationEngine } from '../../core/engine.js';
import { FEATURE_CATALOG } from '../../features/catalog.js';
import { featuresFromConfig, removeFeatureFromConfig } from '../../features/selection.js';
import { pathExists, removePath } from '../../utils/fs.js';
import {
  confirmContinue,
  loadProject,
  planDelta,
  printInstallPlan,
  resolveFeatureId,
  writeManifest,
} from '../helpers.js';
import { CliError, failMark, ok } from '../print.js';

export async function runRemove(
  featureInput: string,
  options: { dryRun?: boolean; yes?: boolean; force?: boolean } = {},
): Promise<void> {
  const { config, cwd } = await loadProject();
  const featureId = resolveFeatureId(featureInput);
  const feature = FEATURE_CATALOG.find((item) => item.id === featureId);
  if (!feature) {
    throw new CliError(`Unknown feature: ${featureInput}`);
  }

  const selected = new Set(featuresFromConfig(config));
  if (!selected.has(featureId) && !config.features.includes(featureId)) {
    throw new CliError(
      `${feature.name} is not installed`,
      `"${featureId}" is not part of this project's configuration.`,
      'Run `pern-starter status` or `pern-starter list` to see selected features.',
    );
  }

  const engine = new GenerationEngine();
  const dependents = engine.dependency
    .dependentsOf(featureId)
    .filter((item) => selected.has(item.id) && item.id !== featureId);

  if (dependents.length) {
    failMark(`Cannot safely remove ${feature.name}.`);
    console.log();
    console.log(`${feature.name} is used by:`);
    console.log();
    for (const dependent of dependents) {
      console.log(`- ${dependent.name}`);
    }
    console.log();
    console.log('Cannot safely remove this feature.');
    console.log();
    console.log('Remove dependent features first.');
    throw new CliError(
      `Cannot remove ${feature.name} while dependents are installed`,
      dependents.map((item) => item.name).join(', '),
      `Run \`pern-starter remove <feature>\` for each dependent, then retry.`,
    );
  }

  const next = removeFeatureFromConfig(config, featureId);
  const before = await engine.plan(config, cwd, { dryRun: true, autoAddDependencies: true });
  const after = await engine.plan(next, cwd, { dryRun: true, autoAddDependencies: true });
  const delta = planDelta(before, after);

  if (options.dryRun) {
    printInstallPlan(delta, cwd);
    return;
  }

  printInstallPlan(delta, cwd);
  const confirmed = await confirmContinue(
    `Remove ${feature.name}? This will not drop databases or secrets.`,
    options.yes,
  );
  if (!confirmed) {
    p.outro('Cancelled.');
    return;
  }

  await writeManifest(cwd, next);

  let removed = 0;
  let skipped = 0;
  for (const file of delta.remove) {
    const abs = join(cwd, file.path);
    if (!pathExists(abs)) continue;
    if (!options.force) {
      try {
        const current = await readFile(abs, 'utf8');
        if (current !== file.contents) {
          skipped += 1;
          continue;
        }
      } catch {
        skipped += 1;
        continue;
      }
    }
    await removePath(abs);
    removed += 1;
  }

  ok(`Removed ${feature.name} from starter.json`);
  if (removed) console.log(`Deleted ${removed} generated file(s).`);
  if (skipped) {
    console.log(
      `Left ${skipped} customized file(s) in place. Pass --force to delete them anyway.`,
    );
  }
}
