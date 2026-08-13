import type { GenerationPlan } from './types.js';

export function renderPlan(plan: GenerationPlan): string {
  const filesToCreate = plan.files.map((file) => `+ ${file.path}`);
  const packages = plan.packages.map(
    (pkg) => `+ ${pkg.name}@${pkg.version} (${pkg.workspace}${pkg.dev ? ', dev' : ''})`,
  );
  const env = plan.env.map((item) => `+ ${item.key}`);
  const docker = plan.dockerServices.map((item) => `+ ${item}`);

  return [
    'Files to create:',
    ...filesToCreate,
    '',
    'Packages:',
    ...(packages.length ? packages : ['(none extra)']),
    '',
    'Environment variables:',
    ...(env.length ? env : ['(none extra)']),
    '',
    'Docker services:',
    ...(docker.length ? docker : ['(none)']),
    '',
    `Features: ${plan.features.join(', ')}`,
  ].join('\n');
}

export function summarizePlan(plan: GenerationPlan): string[] {
  return [
    `Project: ${plan.projectName}`,
    `Files: ${plan.files.length}`,
    `Packages: ${plan.packages.length}`,
    `Env vars: ${plan.env.length}`,
    `Docker: ${plan.dockerServices.join(', ') || 'none'}`,
  ];
}
