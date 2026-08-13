export function pascalCase(value: string): string {
  return splitWords(value)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

export function camelCase(value: string): string {
  const pascal = pascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function kebabCase(value: string): string {
  return splitWords(value).join('-').toLowerCase();
}

export function snakeCase(value: string): string {
  return splitWords(value).join('_').toLowerCase();
}

export function constantCase(value: string): string {
  return splitWords(value).join('_').toUpperCase();
}

export function pluralize(value: string): string {
  const lower = value.toLowerCase();
  if (lower.endsWith('ies')) return value;
  if (lower.endsWith('y') && !/[aeiou]y$/i.test(value)) {
    return `${value.slice(0, -1)}ies`;
  }
  if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('ch') || lower.endsWith('sh')) {
    return `${value}es`;
  }
  if (lower.endsWith('s')) return value;
  return `${value}s`;
}

export function singularize(value: string): string {
  if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('ses') || value.endsWith('xes') || value.endsWith('ches') || value.endsWith('shes')) {
    return value.slice(0, -2);
  }
  if (value.endsWith('s') && !value.endsWith('ss')) return value.slice(0, -1);
  return value;
}

function splitWords(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-\s]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

export function extFor(language: 'typescript' | 'javascript', kind: 'ts' | 'tsx' = 'ts'): string {
  if (language === 'javascript') {
    return kind === 'tsx' ? 'jsx' : 'js';
  }
  return kind;
}
