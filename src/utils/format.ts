import prettier from 'prettier';

const prettierByExt: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'babel',
  jsx: 'babel',
  json: 'json',
  md: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  css: 'css',
  html: 'html',
};

export async function formatGeneratedFile(path: string, contents: string): Promise<string> {
  const ext = path.split('.').pop() ?? '';
  const parser = prettierByExt[ext];
  if (!parser) return contents.endsWith('\n') ? contents : `${contents}\n`;

  try {
    return await prettier.format(contents, {
      parser,
      singleQuote: true,
      trailingComma: 'all',
      printWidth: 90,
    });
  } catch {
    return contents.endsWith('\n') ? contents : `${contents}\n`;
  }
}
