import pc from 'picocolors';
import { ARCHITECTURE_CATALOG } from '../../architectures/catalog.js';
import { FEATURE_CATALOG } from '../../features/catalog.js';
import { PATTERN_CATALOG } from '../../patterns/catalog.js';
import { FeatureRegistry, PatternRegistry } from '../../core/registry.js';

export async function runPatterns(): Promise<void> {
  const registry = new PatternRegistry();
  console.log(pc.bold('Design patterns'));
  console.log();
  for (const [category, patterns] of registry.byCategory()) {
    console.log(pc.bold(category));
    for (const pattern of patterns) {
      console.log(`  ${pc.cyan(pattern.id.padEnd(28))} ${pattern.name}`);
      console.log(pc.dim(`  ${''.padEnd(28)} ${pattern.description}`));
      if (pattern.warn) console.log(pc.yellow(`  ${''.padEnd(28)} ${pattern.warn}`));
    }
    console.log();
  }
}

export async function runArchitectures(): Promise<void> {
  console.log(pc.bold('Architectures'));
  console.log();
  for (const item of ARCHITECTURE_CATALOG) {
    console.log(`${pc.cyan(item.id.padEnd(24))} ${item.name}`);
    console.log(pc.dim(`${''.padEnd(24)} ${item.description}`));
    if (item.conflicts.length) {
      console.log(pc.yellow(`${''.padEnd(24)} conflicts: ${item.conflicts.join(', ')}`));
    }
    console.log();
  }
}

export async function runFeatures(): Promise<void> {
  const registry = new FeatureRegistry();
  console.log(pc.bold(`Features (${FEATURE_CATALOG.length})`));
  console.log();
  for (const [category, features] of registry.byCategory()) {
    console.log(pc.bold(category));
    for (const feature of features) {
      const extras = [
        feature.dependencies.length ? `deps: ${feature.dependencies.join(', ')}` : null,
        feature.conflicts.length ? `conflicts: ${feature.conflicts.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      console.log(`  ${pc.cyan(feature.id.padEnd(28))} ${feature.name}`);
      console.log(pc.dim(`  ${''.padEnd(28)} ${feature.description}`));
      if (extras) console.log(pc.dim(`  ${''.padEnd(28)} ${extras}`));
    }
    console.log();
  }
}

export { PATTERN_CATALOG, ARCHITECTURE_CATALOG, FEATURE_CATALOG };
