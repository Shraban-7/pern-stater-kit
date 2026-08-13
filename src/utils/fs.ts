import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function writeFileEnsured(path: string, contents: string): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, contents, 'utf8');
}

export async function readText(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

export function pathExists(path: string): boolean {
  return existsSync(path);
}

export async function removePath(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

export function toPosix(path: string): string {
  return path.replaceAll('\\', '/');
}

export function joinPosix(...parts: string[]): string {
  return toPosix(join(...parts));
}

export function resolveDestination(cwd: string, name: string): string {
  return resolve(cwd, name);
}
