import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { CliError } from '../print.js';

export async function runUi(): Promise<void> {
  const require = createRequire(import.meta.url);
  let viteBin: string;
  try {
    viteBin = require.resolve('vite/bin/vite.js');
  } catch {
    throw new CliError(
      'Vite is not installed',
      'This command needs the Vite package in this repo.',
      'Run `npm install` then `npm run dev`.',
    );
  }

  const child = spawn(process.execPath, [viteBin], {
    cwd: process.cwd(),
    stdio: 'inherit',
    windowsHide: false,
    env: { ...process.env },
  });

  await new Promise<void>((resolve, reject) => {
    child.on('exit', (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new CliError(`Vite exited with code ${code}`));
    });
    child.on('error', (error) => {
      reject(
        new CliError('Could not start Vite', error.message, 'Run `npm run dev` from the repo root.'),
      );
    });
  });
}
