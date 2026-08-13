import { handleStarterApi } from '../dist/server/api.js';

type QueryValue = string | string[] | undefined;

type ApiRequest = {
  method?: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

function queryValue(value: QueryValue): string {
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value ?? '');
}

async function readBody(req: ApiRequest): Promise<unknown> {
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

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json');
  const method = req.method ?? 'GET';
  if (method === 'OPTIONS') {
    res.status(204).json({});
    return;
  }
  const action = queryValue(req.query?.action);
  const path = `/api/${action}`;
  const body = method === 'GET' ? {} : await readBody(req);
  const result = await handleStarterApi(method, path, body);
  res.status(result.status).json(result.body);
}

export const config = {
  maxDuration: 60,
};
