import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { getCliVersion, safeExec } from '../helpers.js';
import { ok } from '../print.js';

async function localVersion(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, '../../../package.json'), join(here, '../../../../package.json')];
  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(await readFile(candidate, 'utf8')) as { name?: string; version?: string };
      if (pkg.name === 'pern-starter' && pkg.version) return pkg.version;
    } catch {
      // keep looking
    }
  }
  return getCliVersion();
}

export async function runUpdate(): Promise<void> {
  const current = await localVersion();
  ok(`pern-starter ${current}`);
  console.log();
  console.log('Upgrade with one of:');
  console.log();
  console.log(`  ${pc.cyan('npm update -g pern-starter')}`);
  console.log(`  ${pc.cyan('pnpm update -g pern-starter')}`);
  console.log(`  ${pc.cyan('yarn global upgrade pern-starter')}`);
  console.log();

  const latest = await safeExec('npm', ['view', 'pern-starter', 'version'], { timeout: 5000 });
  if (latest.ok && latest.output) {
    const version = latest.output.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (version && version !== current) {
      console.log(`Latest published version: ${version}`);
      console.log(`You are on ${current}.`);
    } else if (version) {
      console.log('You are on the latest published version.');
    }
    return;
  }

  console.log(pc.dim('Could not check the registry. Local version is shown above.'));
}
