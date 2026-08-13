import type { Generator } from '../../core/types.js';
import { AuthGenerator } from './auth.js';
import { AppAssemblerGenerator, CoreGenerator } from './core.js';
import { DatabaseGenerator } from './database.js';
import { ErrorsGenerator } from './errors.js';
import { InfraFeaturesGenerator } from './infra-features.js';
import { ModulesGenerator } from './modules.js';

export function createBackendGenerators(): Generator[] {
  return [
    new CoreGenerator(),
    new ErrorsGenerator(),
    new DatabaseGenerator(),
    new AuthGenerator(),
    new ModulesGenerator(),
    new InfraFeaturesGenerator(),
    new AppAssemblerGenerator(),
  ];
}

export { AuthGenerator } from './auth.js';
export { AppAssemblerGenerator, CoreGenerator } from './core.js';
export { DatabaseGenerator } from './database.js';
export { ErrorsGenerator } from './errors.js';
export { InfraFeaturesGenerator } from './infra-features.js';
export { ModulesGenerator } from './modules.js';
