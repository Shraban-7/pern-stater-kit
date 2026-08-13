import type { Plugin } from 'vite';
import { handleStarterApi } from '../src/server/api.ts';

function send(
  res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b?: string) => void },
  status: number,
  body: unknown,
) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readJson(req: { on: (event: string, cb: (chunk?: Buffer) => void) => void }): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolvePromise({});
        return;
      }
      try {
        resolvePromise(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

export function starterApiPlugin(): Plugin {
  return {
    name: 'pern-starter-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.startsWith('/api/')) {
          next();
          return;
        }
        try {
          const body = req.method === 'GET' ? {} : await readJson(req);
          const result = await handleStarterApi(req.method ?? 'GET', url, body);
          send(res, result.status, result.body);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          send(res, 400, { ok: false, error: message });
        }
      });
    },
  };
}
