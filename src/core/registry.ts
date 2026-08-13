import type {
  ArchitectureDefinition,
  ArchitectureId,
  FeatureDefinition,
  PatternDefinition,
  PatternId,
} from './types.js';
import { FEATURE_CATALOG } from '../features/catalog.js';
import { ARCHITECTURE_CATALOG } from '../architectures/catalog.js';
import { PATTERN_CATALOG } from '../patterns/catalog.js';

export class FeatureRegistry {
  constructor(private readonly features: FeatureDefinition[] = FEATURE_CATALOG) {}

  all(): FeatureDefinition[] {
    return this.features;
  }

  get(id: string): FeatureDefinition | undefined {
    return this.features.find((feature) => feature.id === id);
  }

  require(id: string): FeatureDefinition {
    const feature = this.get(id);
    if (!feature) {
      throw new Error(`Unknown feature: ${id}`);
    }
    return feature;
  }

  byCategory(): Map<string, FeatureDefinition[]> {
    const map = new Map<string, FeatureDefinition[]>();
    for (const feature of this.features) {
      const list = map.get(feature.category) ?? [];
      list.push(feature);
      map.set(feature.category, list);
    }
    return map;
  }
}

export class ArchitectureRegistry {
  constructor(private readonly items: ArchitectureDefinition[] = ARCHITECTURE_CATALOG) {}

  all(): ArchitectureDefinition[] {
    return this.items;
  }

  get(id: ArchitectureId): ArchitectureDefinition | undefined {
    return this.items.find((item) => item.id === id);
  }
}

export class PatternRegistry {
  constructor(private readonly items: PatternDefinition[] = PATTERN_CATALOG) {}

  all(): PatternDefinition[] {
    return this.items;
  }

  get(id: PatternId): PatternDefinition | undefined {
    return this.items.find((item) => item.id === id);
  }

  byCategory(): Map<PatternDefinition['category'], PatternDefinition[]> {
    const map = new Map<PatternDefinition['category'], PatternDefinition[]>();
    for (const pattern of this.items) {
      const list = map.get(pattern.category) ?? [];
      list.push(pattern);
      map.set(pattern.category, list);
    }
    return map;
  }
}
