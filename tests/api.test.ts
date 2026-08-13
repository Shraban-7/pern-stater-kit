import { describe, expect, it } from 'vitest';
import { handleStarterApi } from '../src/server/api.js';

describe('hosted starter API', () => {
  it('returns a default config without writing disk', async () => {
    const result = await handleStarterApi('GET', '/api/defaults');
    expect(result.status).toBe(200);
    const body = result.body as { config: { name: string; frontend: { kind: string } } };
    expect(body.config.name).toBe('my-app');
    expect(body.config.frontend.kind).toBe('vite-react');
  });

  it('bundles generated files in memory for local save', async () => {
    const defaults = await handleStarterApi('GET', '/api/defaults');
    const config = (defaults.body as { config: unknown }).config;
    const result = await handleStarterApi('POST', '/api/bundle', { config });
    expect(result.status).toBe(200);
    const body = result.body as {
      project: string;
      contents: Array<{ path: string; contents: string }>;
      next: string[];
    };
    expect(body.project).toBe('my-app');
    expect(body.contents.length).toBeGreaterThan(20);
    expect(body.contents.every((file) => file.path && typeof file.contents === 'string')).toBe(true);
    expect(body.next[0]).toBe('cd my-app');
  });
});
