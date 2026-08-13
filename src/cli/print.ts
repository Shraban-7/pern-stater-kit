import { join } from 'node:path';
import pc from 'picocolors';
import { cancel, isCancel } from '@clack/prompts';
import type {
  GenerationPlan,
  PackageManager,
  StarterConfig,
  ValidationIssue,
} from '../core/types.js';
import { pathExists } from '../utils/fs.js';

const BOX_WIDTH = 46;

export class CliError extends Error {
  readonly reason?: string;
  readonly fix?: string;

  constructor(message: string, reason?: string, fix?: string) {
    super(message);
    this.name = 'CliError';
    this.reason = reason;
    this.fix = fix;
  }
}

export function handleCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Cancelled.');
    process.exit(0);
  }
  return value;
}

export function ok(label: string): void {
  console.log(`${pc.green('✓')} ${label}`);
}

export function failMark(label: string): void {
  console.log(`${pc.red('✗')} ${label}`);
}

export function warnMark(label: string): void {
  console.log(`${pc.yellow('!')} ${label}`);
}

function center(text: string, width: number): string {
  const visible = text.replace(/\u001b\[[0-9;]*m/g, '');
  const pad = Math.max(0, width - visible.length);
  const left = Math.floor(pad / 2);
  return `${' '.repeat(left)}${text}${' '.repeat(pad - left)}`;
}

function padLine(text: string, width: number): string {
  const visible = text.replace(/\u001b\[[0-9;]*m/g, '');
  const clipped = visible.length > width ? `${visible.slice(0, width - 1)}…` : text;
  const vis = clipped.replace(/\u001b\[[0-9;]*m/g, '');
  return `${clipped}${' '.repeat(Math.max(0, width - vis.length))}`;
}

export function printBox(title: string, lines: string[] = []): void {
  const inner = BOX_WIDTH - 2;
  console.log(pc.green(`╭${'─'.repeat(inner)}╮`));
  console.log(pc.green('│') + pc.bold(center(title, inner)) + pc.green('│'));
  if (lines.length) {
    console.log(pc.green('│') + ' '.repeat(inner) + pc.green('│'));
    for (const line of lines) {
      console.log(pc.green('│') + padLine(line, inner) + pc.green('│'));
    }
  }
  console.log(pc.green(`╰${'─'.repeat(inner)}╯`));
}

export function printRule(): void {
  console.log(pc.dim('━'.repeat(40)));
}

export function labelArchitecture(id: string): string {
  return id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function labelAuth(auth: StarterConfig['auth']): string {
  switch (auth) {
    case 'jwt-refresh-token':
      return 'JWT + Refresh Token';
    case 'jwt':
      return 'JWT';
    case 'session':
      return 'Session';
    case 'oauth2':
      return 'OAuth2';
    default:
      return 'None';
  }
}

export function labelFrontend(kind: StarterConfig['frontend']['kind']): string {
  switch (kind) {
    case 'vite-react':
      return 'React + Vite';
    case 'nextjs':
      return 'Next.js';
    default:
      return 'None';
  }
}

export function labelUi(ui: StarterConfig['frontend']['ui']): string {
  switch (ui) {
    case 'shadcn':
      return 'Tailwind + shadcn/ui';
    case 'tailwind':
      return 'Tailwind CSS';
    case 'mui':
      return 'Material UI';
    case 'antd':
      return 'Ant Design';
    case 'chakra':
      return 'Chakra UI';
    case 'headless':
      return 'Headless UI';
    default:
      return 'None';
  }
}

export function printConfigSummary(config: StarterConfig): void {
  const infra: string[] = [];
  if (config.cache === 'redis') infra.push('Redis');
  if (config.docker !== 'none') infra.push('Docker');
  if (config.queue === 'bullmq') infra.push('BullMQ');

  const payments = config.payments.length
    ? config.payments.map((item) => (item === 'bkash' ? 'bKash' : item.charAt(0).toUpperCase() + item.slice(1))).join(' + ')
    : 'None';

  const testing = [
    config.testing.unit === 'vitest' ? 'Vitest' : 'Jest',
    config.testing.e2e === 'playwright' ? 'Playwright' : config.testing.e2e === 'cypress' ? 'Cypress' : null,
  ]
    .filter(Boolean)
    .join(' + ');

  const rows: Array<[string, string]> = [
    ['Backend', `${config.backend.framework === 'fastify' ? 'Fastify' : 'Express'} + ${config.language === 'javascript' ? 'JavaScript' : 'TypeScript'}`],
    [
      'Frontend',
      config.frontend.kind === 'none'
        ? 'None'
        : `${labelFrontend(config.frontend.kind)} + ${config.language === 'javascript' ? 'JavaScript' : 'TypeScript'}`,
    ],
    ['Database', 'PostgreSQL'],
    ['ORM', config.orm.charAt(0).toUpperCase() + config.orm.slice(1)],
    ['Authentication', labelAuth(config.auth)],
    ['RBAC', config.rbac === 'none' ? 'None' : config.rbac === 'custom' ? 'Custom' : config.rbac.toUpperCase()],
    ['Architecture', labelArchitecture(config.architecture)],
    ['Infrastructure', infra.length ? infra.join(' + ') : 'None'],
    ['Payments', payments],
    ['Testing', testing],
  ];

  console.log();
  printRule();
  console.log();
  console.log(pc.bold('PROJECT CONFIGURATION'));
  console.log();
  for (const [label, value] of rows) {
    console.log(`${label}:`);
    console.log(value);
    console.log();
  }
  printRule();
  console.log();
}

export function printSuccessCreated(config: StarterConfig, destinationName: string): void {
  console.log();
  printBox('PROJECT CREATED');
  console.log();

  const lines: Array<[string, string]> = [
    ['Project', destinationName],
    ['Backend', config.frontend.kind === 'none' && config.monorepo === 'none' ? '.' : 'apps/api'],
  ];

  if (config.frontend.kind !== 'none') {
    lines.push(['Frontend', 'apps/web']);
  }

  lines.push(
    ['Database', `PostgreSQL + ${config.orm.charAt(0).toUpperCase() + config.orm.slice(1)}`],
    ['Authentication', labelAuth(config.auth)],
    ['RBAC', config.rbac === 'none' ? 'None' : config.rbac === 'custom' ? 'Custom' : config.rbac],
    ['Architecture', labelArchitecture(config.architecture)],
  );

  if (config.cache === 'redis') lines.push(['Cache', 'Redis']);
  if (config.queue === 'bullmq') lines.push(['Queue', 'BullMQ']);
  if (config.payments.length) {
    lines.push([
      'Payments',
      config.payments.map((item) => (item === 'bkash' ? 'bKash' : item.charAt(0).toUpperCase() + item.slice(1))).join(' + '),
    ]);
  }
  if (config.storage !== 'none') lines.push(['Storage', config.storage.toUpperCase()]);
  lines.push([
    'Testing',
    [
      config.testing.unit === 'vitest' ? 'Vitest' : 'Jest',
      config.testing.e2e === 'none' ? null : config.testing.e2e === 'playwright' ? 'Playwright' : 'Cypress',
    ]
      .filter(Boolean)
      .join(' + '),
  ]);
  lines.push(['Docker', config.docker === 'none' ? 'Disabled' : 'Enabled']);

  for (const [label, value] of lines) {
    console.log(`${label}:`);
    console.log(value);
    console.log();
  }

  console.log(pc.bold('Next:'));
  console.log();
  for (const step of nextSteps(config, destinationName)) {
    console.log(step);
    console.log();
  }
}

export function nextSteps(config: StarterConfig, destinationName: string): string[] {
  const pm = config.packageManager;
  const apiEnv =
    config.frontend.kind === 'none' && config.monorepo === 'none'
      ? '.env.example .env'
      : 'apps/api/.env.example apps/api/.env';
  const steps = [`cd ${destinationName}`, `cp ${apiEnv}`];
  if (config.frontend.kind !== 'none') {
    steps.push('cp apps/web/.env.example apps/web/.env');
  }
  steps.push(`${pm} install`);
  if (config.docker !== 'none') {
    steps.push('docker compose up -d');
  }
  steps.push(`${pm} db:migrate`);
  steps.push(`${pm} dev`);
  return steps;
}

export function printGenerationChecklist(config: StarterConfig): void {
  ok('Configuration');
  ok('Dependencies');
  ok('Database');
  if (config.auth !== 'none') ok('Authentication');
  ok('Backend');
  if (config.frontend.kind !== 'none') ok('Frontend');
  if (config.cache === 'redis' || config.docker !== 'none' || config.queue === 'bullmq') {
    ok('Infrastructure');
  }
  ok('Testing');
  if (config.openapi !== 'none') ok('Documentation');
}

export function printDryRun(plan: GenerationPlan, cwd = process.cwd()): void {
  const create: string[] = [];
  const modify: string[] = [];

  for (const file of plan.files) {
    if (pathExists(join(cwd, file.path))) modify.push(`~ ${file.path}`);
    else create.push(`+ ${file.path}`);
  }

  console.log(pc.bold('Files to create:'));
  if (create.length) create.forEach((line) => console.log(pc.green(line)));
  else console.log('(none)');
  console.log();
  console.log(pc.bold('Files to modify:'));
  if (modify.length) modify.forEach((line) => console.log(pc.yellow(line)));
  else console.log('(none)');
  console.log();
  console.log(pc.bold('Packages:'));
  if (plan.packages.length) {
    for (const pkg of plan.packages) {
      console.log(pc.green(`+ ${pkg.name}@${pkg.version} (${pkg.workspace}${pkg.dev ? ', dev' : ''})`));
    }
  } else {
    console.log('(none extra)');
  }
  console.log();
  if (plan.env.length) {
    console.log(pc.bold('Environment variables:'));
    for (const env of plan.env) {
      console.log(pc.green(`+ ${env.key}`));
    }
    console.log();
  }
  if (plan.dockerServices.length) {
    console.log(pc.bold('Docker services:'));
    for (const service of plan.dockerServices) {
      console.log(pc.green(`+ ${service}`));
    }
    console.log();
  }
}

export function printIssue(issue: ValidationIssue, mark: 'error' | 'warning' = 'error'): void {
  if (mark === 'error') failMark(issue.message);
  else warnMark(issue.message);
  if (issue.path) {
    console.log(pc.dim(`  path: ${issue.path}`));
  }
  if (issue.message) {
    console.log();
    console.log(pc.bold('Reason:'));
    console.log(issue.message);
  }
  if (issue.fix) {
    console.log();
    console.log(pc.bold('Fix:'));
    console.log(issue.fix);
  }
}

export function printFailure(error: unknown): void {
  if (error instanceof CliError) {
    failMark(error.message);
    if (error.reason) {
      console.log();
      console.log(pc.bold('Reason:'));
      console.log(error.reason);
    }
    if (error.fix) {
      console.log();
      console.log(pc.bold('Fix:'));
      console.log(error.fix);
    }
    maybeDebug(error);
    return;
  }

  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues: ValidationIssue[] }).issues ?? [];
    if (issues.length) {
      for (const issue of issues) {
        printIssue(issue);
        console.log();
      }
      maybeDebug(error);
      return;
    }
  }

  const err = error instanceof Error ? error : new Error(String(error));
  failMark(err.message || 'Command failed');
  console.log();
  console.log(pc.bold('Reason:'));
  console.log(err.message || 'An unexpected error occurred.');
  console.log();
  console.log(pc.bold('Fix:'));
  console.log('Check the command arguments and project configuration, then try again.');
  maybeDebug(err);
}

function maybeDebug(error: unknown): void {
  if (!process.env.DEBUG) return;
  if (error instanceof Error && error.stack) {
    console.log();
    console.log(pc.dim(error.stack));
  }
}

export function installCommand(pm: PackageManager): string[] {
  switch (pm) {
    case 'yarn':
      return ['yarn', 'install'];
    case 'bun':
      return ['bun', 'install'];
    case 'npm':
      return ['npm', 'install'];
    default:
      return ['pnpm', 'install'];
  }
}
