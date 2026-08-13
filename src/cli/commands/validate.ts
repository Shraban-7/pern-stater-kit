import { GenerationEngine } from '../../core/engine.js';
import { validateConfigDocument } from '../../core/config.js';
import { loadProject } from '../helpers.js';
import { CliError, ok, printIssue } from '../print.js';

export async function runValidate(): Promise<void> {
  const { config } = await loadProject();
  const schema = validateConfigDocument(config);
  if (!schema.ok) {
    for (const issue of schema.errors) printIssue(issue);
    throw new CliError('Configuration is invalid', schema.errors[0]?.message, schema.errors[0]?.fix);
  }

  const engine = new GenerationEngine();
  const result = engine.validate(config);
  if (!result.ok) {
    for (const issue of result.errors) printIssue(issue);
    throw new CliError(
      'Configuration failed validation',
      result.errors[0]?.message,
      result.errors[0]?.fix,
    );
  }

  ok('Configuration');
  ok('Dependencies');
  for (const warning of result.warnings) {
    printIssue(warning, 'warning');
  }
  if (!result.warnings.length) {
    console.log('starter.json is valid.');
  }
}
