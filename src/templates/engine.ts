import Handlebars from 'handlebars';
import { camelCase, kebabCase, pascalCase, snakeCase } from '../utils/naming.js';

let helpersRegistered = false;

function registerHelpers(): void {
  if (helpersRegistered) return;

  Handlebars.registerHelper('pascalCase', (value: string) => pascalCase(value));
  Handlebars.registerHelper('camelCase', (value: string) => camelCase(value));
  Handlebars.registerHelper('kebabCase', (value: string) => kebabCase(value));
  Handlebars.registerHelper('snakeCase', (value: string) => snakeCase(value));
  Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  Handlebars.registerHelper('includes', (list: unknown, value: unknown) =>
    Array.isArray(list) ? list.includes(value) : false,
  );
  Handlebars.registerHelper('json', (value: unknown) => JSON.stringify(value, null, 2));
  Handlebars.registerHelper('ts', (config: { language?: string }) =>
    config.language !== 'javascript',
  );

  helpersRegistered = true;
}

export class TemplateEngine {
  constructor() {
    registerHelpers();
  }

  render(source: string, data: Record<string, unknown>): string {
    const template = Handlebars.compile(source, { noEscape: true });
    return template(data);
  }
}

export const templates = new TemplateEngine();
