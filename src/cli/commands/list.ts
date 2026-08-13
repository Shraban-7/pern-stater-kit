import pc from 'picocolors';
import { FEATURE_CATALOG } from '../../features/catalog.js';
import { featuresFromConfig } from '../../features/selection.js';
import { readManifest } from '../../core/config.js';
import { FeatureRegistry } from '../../core/registry.js';

export async function runList(): Promise<void> {
  const config = await readManifest(process.cwd());
  if (!config) {
    console.log(pc.dim('Not inside a generated project. Showing the feature catalog.'));
    console.log();
    printCatalog();
    return;
  }

  const selected = new Set(featuresFromConfig(config));
  console.log(pc.bold(`Selected features for ${config.name}`));
  console.log();
  for (const feature of FEATURE_CATALOG) {
    if (!selected.has(feature.id)) continue;
    console.log(`${pc.green('✓')} ${pc.bold(feature.id)}  ${feature.name}`);
    console.log(pc.dim(`  ${feature.description}`));
  }
}

function printCatalog(): void {
  const registry = new FeatureRegistry();
  for (const [category, features] of registry.byCategory()) {
    console.log(pc.bold(category));
    for (const feature of features) {
      console.log(`  ${feature.id.padEnd(28)} ${feature.name}`);
    }
    console.log();
  }
}
