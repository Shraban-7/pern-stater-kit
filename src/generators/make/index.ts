export {
  generateCrud,
  parseFieldDsl,
  formControlFor,
  FORM_CONTROL_MAP,
  type CrudField,
  type CrudFieldType,
  type CrudLayer,
  type GenerateCrudOptions,
} from './crud.js';
export {
  generateScaffold,
  generateModule,
  type GenerateScaffoldOptions,
  type ScaffoldKind,
} from './scaffold.js';
export { generatePattern, type GeneratePatternOptions } from './pattern.js';

import { generateCrud, parseFieldDsl } from './crud.js';
import { generateModule, generateScaffold } from './scaffold.js';
import { generatePattern } from './pattern.js';

export function createMakeGenerators() {
  return {
    generateCrud,
    generateScaffold,
    generateModule,
    generatePattern,
    parseFieldDsl,
  };
}
