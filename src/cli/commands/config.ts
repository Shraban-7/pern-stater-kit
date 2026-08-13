import { dumpConfig, loadProject } from '../helpers.js';

export async function runConfig(options: { json?: boolean } = {}): Promise<void> {
  const { config } = await loadProject();
  process.stdout.write(dumpConfig(config, options.json ? 'json' : 'yaml'));
}
