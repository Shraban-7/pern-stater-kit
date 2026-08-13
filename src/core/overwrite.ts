import type { OverwriteChoice } from './types.js';
import { pathExists } from '../utils/fs.js';

export function destinationConflict(path: string): boolean {
  return pathExists(path);
}

export function resolveOverwrite(
  exists: boolean,
  force: boolean,
  interactiveChoice?: OverwriteChoice,
): OverwriteChoice {
  if (!exists) return 'replace';
  if (force) return 'replace';
  return interactiveChoice ?? 'cancel';
}

export function neverSilentOverwrite(exists: boolean, force: boolean): boolean {
  return exists && !force;
}
