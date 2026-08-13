import type { Generator } from '../core/types.js';
import { createBackendGenerators } from './backend/index.js';
import { createFrontendGenerators } from './frontend/index.js';
import { AgentsGenerator } from './agents.js';
import { DocsGenerator } from './docs.js';
import { InfraGenerator } from './infra.js';
import { PackageManifestGenerator } from './packages.js';
import { RootGenerator } from './root.js';

export function createGenerators(): Generator[] {
  return [
    ...createBackendGenerators(),
    ...createFrontendGenerators(),
    new InfraGenerator(),
    new DocsGenerator(),
    new AgentsGenerator(),
    new RootGenerator(),
    new PackageManifestGenerator(),
  ];
}

export { createBackendGenerators } from './backend/index.js';
export { createFrontendGenerators } from './frontend/index.js';
export { createMakeGenerators } from './make/index.js';
export { RootGenerator } from './root.js';
export { InfraGenerator } from './infra.js';
export { DocsGenerator } from './docs.js';
export { AgentsGenerator } from './agents.js';
