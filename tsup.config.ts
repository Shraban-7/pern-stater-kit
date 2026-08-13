import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    clean: true,
    banner: { js: '#!/usr/bin/env node' },
    shims: true,
    splitting: false,
  },
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    clean: false,
    splitting: false,
  },
  {
    entry: { handler: 'src/server/vercel-handler.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node20',
    dts: false,
    sourcemap: false,
    clean: false,
    splitting: false,
    shims: true,
  },
]);
