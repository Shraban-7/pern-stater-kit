import type { Generator } from '../../core/types.js';
import { AdminGenerator } from './admin.js';
import { WebGenerator } from './web.js';

export { AdminGenerator } from './admin.js';
export { WebGenerator } from './web.js';

export function createFrontendGenerators(): Generator[] {
  return [new WebGenerator(), new AdminGenerator()];
}
