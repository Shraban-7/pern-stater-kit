import { mkdtemp, rename, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { GenerationPlan } from './types.js';
import { formatGeneratedFile } from '../utils/format.js';
import { pathExists, writeFileEnsured } from '../utils/fs.js';

export class Workspace {
  async createTemp(prefix = 'pern-starter-'): Promise<string> {
    return mkdtemp(join(tmpdir(), prefix));
  }

  async materialize(plan: GenerationPlan, root: string): Promise<void> {
    for (const file of plan.files) {
      const formatted = await formatGeneratedFile(file.path, file.contents);
      await writeFileEnsured(join(root, file.path), formatted);
    }
  }

  async finalize(tempRoot: string, destination: string): Promise<void> {
    await mkdir(dirname(destination), { recursive: true });
    try {
      await rename(tempRoot, destination);
    } catch {
      if (pathExists(destination)) {
        throw new Error(`Destination already exists: ${destination}`);
      }
      await cp(tempRoot, destination, { recursive: true });
      await rm(tempRoot, { recursive: true, force: true });
    }
  }

  async cleanup(tempRoot: string): Promise<void> {
    await rm(tempRoot, { recursive: true, force: true });
  }

  resolveDestination(cwd: string, name: string): string {
    return resolve(cwd, name);
  }
}
