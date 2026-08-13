import { join } from 'node:path';
import pc from 'picocolors';
import { readManifest } from '../../core/config.js';
import { validateNodeVersion } from '../../core/runtime.js';
import type { PackageManager } from '../../core/types.js';
import { pathExists } from '../../utils/fs.js';
import { safeExec } from '../helpers.js';
import { failMark, ok, printIssue } from '../print.js';

interface DoctorCheck {
  label: string;
  optional: boolean;
  run: () => Promise<{ ok: boolean; detail?: string; fix?: string }>;
}

function firstLine(output: string): string {
  return output.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? '';
}

async function detectPreferredPm(cwd: string, configured?: PackageManager): Promise<PackageManager> {
  if (configured) return configured;
  if (pathExists(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (pathExists(join(cwd, 'yarn.lock'))) return 'yarn';
  if (pathExists(join(cwd, 'bun.lockb')) || pathExists(join(cwd, 'bun.lock'))) return 'bun';
  if (pathExists(join(cwd, 'package-lock.json'))) return 'npm';
  return 'pnpm';
}

export async function runDoctor(): Promise<void> {
  const cwd = process.cwd();
  const config = await readManifest(cwd).catch(() => null);
  const pm = await detectPreferredPm(cwd, config?.packageManager);
  let failedRequired = false;

  const checks: DoctorCheck[] = [
    {
      label: 'Node',
      optional: false,
      run: async () => {
        const issues = await validateNodeVersion(config?.nodeVersion);
        if (issues.length) {
          return { ok: false, detail: issues[0]?.message, fix: issues[0]?.fix };
        }
        return { ok: true, detail: `v${process.versions.node}` };
      },
    },
    {
      label: pm,
      optional: false,
      run: async () => {
        const result = await safeExec(pm, ['--version']);
        if (!result.ok) {
          return {
            ok: false,
            detail: `${pm} is not installed or not on PATH.`,
            fix: `Install ${pm} or choose a different package manager.`,
          };
        }
        return { ok: true, detail: firstLine(result.output) };
      },
    },
    {
      label: 'Docker',
      optional: true,
      run: async () => {
        const result = await safeExec('docker', ['--version']);
        if (!result.ok) {
          return {
            ok: false,
            detail: 'Docker is not installed or not on PATH.',
            fix: 'Install Docker Desktop or the Docker CLI if you need containers.',
          };
        }
        return { ok: true, detail: firstLine(result.output) };
      },
    },
    {
      label: 'PostgreSQL',
      optional: true,
      run: async () => {
        const result = await safeExec('psql', ['--version']);
        if (!result.ok) {
          return {
            ok: false,
            detail: 'psql is not installed or PostgreSQL is not on PATH.',
            fix: 'Install PostgreSQL client tools, or use Docker: docker compose up -d postgres.',
          };
        }
        return { ok: true, detail: firstLine(result.output) };
      },
    },
    {
      label: 'Redis',
      optional: true,
      run: async () => {
        const ping = await safeExec('redis-cli', ['ping']);
        if (ping.ok && /pong/i.test(ping.output)) {
          return { ok: true, detail: 'PONG' };
        }
        const version = await safeExec('redis-cli', ['--version']);
        if (version.ok) {
          return {
            ok: false,
            detail: 'redis-cli found but Redis did not respond to PING.',
            fix: 'Start Redis locally or with docker compose up -d redis.',
          };
        }
        return {
          ok: false,
          detail: 'Redis is not installed or not running.',
          fix: 'Install Redis or start it with Docker if your project uses cache or BullMQ.',
        };
      },
    },
  ];

  if (config) {
    checks.push(
      {
        label: 'Environment',
        optional: true,
        run: async () => {
          const apiEnv =
            config.frontend.kind === 'none' && config.monorepo === 'none'
              ? join(cwd, '.env')
              : join(cwd, 'apps/api/.env');
          if (pathExists(apiEnv)) return { ok: true, detail: apiEnv };
          return {
            ok: false,
            detail: 'No .env file found.',
            fix: 'Copy .env.example to .env and fill in secrets.',
          };
        },
      },
      {
        label: 'Dependencies',
        optional: true,
        run: async () => {
          if (pathExists(join(cwd, 'node_modules'))) return { ok: true, detail: 'node_modules present' };
          return {
            ok: false,
            detail: 'node_modules is missing.',
            fix: `Run \`${pm} install\`.`,
          };
        },
      },
    );
  }

  const ts = await safeExec('tsc', ['--version']);
  checks.push({
    label: 'TypeScript',
    optional: true,
    run: async () => {
      if (ts.ok) return { ok: true, detail: firstLine(ts.output) };
      const npx = await safeExec('npx', ['tsc', '--version']);
      if (npx.ok) return { ok: true, detail: firstLine(npx.output) };
      return {
        ok: false,
        detail: 'TypeScript compiler was not found.',
        fix: 'Install typescript as a dev dependency or globally.',
      };
    },
  });

  for (const check of checks) {
    try {
      const result = await check.run();
      if (result.ok) {
        ok(result.detail ? `${check.label}  ${pc.dim(result.detail)}` : check.label);
      } else {
        failMark(check.label);
        if (result.detail) {
          console.log();
          console.log(pc.bold('Reason:'));
          console.log(result.detail);
        }
        if (result.fix) {
          console.log();
          console.log(pc.bold('Fix:'));
          console.log(result.fix);
          console.log();
        }
        if (!check.optional) failedRequired = true;
      }
    } catch (error) {
      failMark(check.label);
      printIssue({
        code: 'DOCTOR_CHECK_FAILED',
        message: error instanceof Error ? error.message : String(error),
        fix: 'Install the missing tool or ignore this optional check.',
      });
      if (!check.optional) failedRequired = true;
    }
  }

  if (failedRequired) {
    process.exitCode = 1;
  }
}
