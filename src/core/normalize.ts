import type { StarterConfig } from './types.js';

export function normalizeConfig(input: StarterConfig): StarterConfig {
  const next = structuredClone(input);
  if (next.frontend.kind !== 'none') {
    next.frontend.kind = 'vite-react';
    next.frontend.router = true;
  }
  if (next.queue === 'bullmq' && next.cache !== 'redis') next.cache = 'redis';
  if (next.frontend.kind === 'none') next.monorepo = 'none';
  else if (next.monorepo === 'none') next.monorepo = 'turborepo';
  return next;
}
