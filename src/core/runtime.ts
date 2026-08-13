import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import semver from 'semver';
import type { PackageManager, ValidationIssue } from './types.js';
import { DEFAULT_NODE_VERSION } from './defaults.js';

const execFileAsync = promisify(execFile);

export async function validateNodeVersion(requested = DEFAULT_NODE_VERSION): Promise<ValidationIssue[]> {
  const current = process.versions.node;
  const issues: ValidationIssue[] = [];

  if (!semver.satisfies(current, '>=20')) {
    issues.push({
      code: 'NODE_UNSUPPORTED',
      message: `Node ${current} is not supported. Install Node 20 LTS or newer.`,
      fix: 'Use nvm, fnm, or the official installer to switch Node versions.',
    });
  }

  const requestedMajor = semver.coerce(requested)?.major;
  const currentMajor = semver.coerce(current)?.major;
  if (requestedMajor && currentMajor && currentMajor < requestedMajor) {
    issues.push({
      code: 'NODE_MISMATCH',
      message: `This project targets Node ${requested} but the current runtime is ${current}.`,
      fix: `Switch to Node ${requested} before generating.`,
    });
  }

  return issues;
}

export async function detectPackageManager(preferred: PackageManager): Promise<ValidationIssue[]> {
  const command = preferred === 'npm' ? 'npm' : preferred;
  try {
    await execFileAsync(command, ['--version']);
    return [];
  } catch {
    return [
      {
        code: 'PACKAGE_MANAGER_MISSING',
        message: `${preferred} is not installed or not on PATH.`,
        fix: `Install ${preferred} or choose a different package manager.`,
      },
    ];
  }
}

export function engineField(nodeVersion: string): Record<string, string> {
  return { node: `>=${semver.coerce(nodeVersion)?.major ?? 20}` };
}
