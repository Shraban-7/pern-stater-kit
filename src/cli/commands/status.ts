import pc from 'picocolors';
import { featuresFromConfig } from '../../features/selection.js';
import { loadProject } from '../helpers.js';
import {
  labelArchitecture,
  labelAuth,
  labelFrontend,
  ok,
} from '../print.js';

export async function runStatus(): Promise<void> {
  const { config } = await loadProject();
  const features = featuresFromConfig(config);

  console.log(pc.bold(`${config.name}`));
  console.log(pc.dim('PERN starter project'));
  console.log();
  ok(`Architecture  ${labelArchitecture(config.architecture)}`);
  ok(`Language      ${config.language}`);
  ok(`Package mgr   ${config.packageManager}`);
  ok(`Node          ${config.nodeVersion}`);
  ok(`Backend       ${config.backend.framework} (${config.backend.api})`);
  ok(`ORM           ${config.orm}`);
  ok(`Auth          ${labelAuth(config.auth)}`);
  ok(`Frontend      ${labelFrontend(config.frontend.kind)}`);
  ok(`Features      ${features.length} selected`);
  console.log();
  console.log(pc.dim(features.join(', ')));
}
