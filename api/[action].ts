import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleStarterApi } from '../src/server/api';

async function readBody(req: VercelRequest): Promise<unknown> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const action = String(req.query.action ?? '');
  const path = `/api/${action}`;
  const method = req.method ?? 'GET';
  const body = method === 'GET' ? {} : await readBody(req);
  const result = await handleStarterApi(method, path, body);
  res.status(result.status).json(result.body);
}

export const config = {
  maxDuration: 60,
};
