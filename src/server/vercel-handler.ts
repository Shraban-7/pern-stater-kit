import { handleStarterApi } from './api.js';

type QueryValue = string | string[] | undefined;

type ApiRequest = {
  method?: string;
  url?: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  end: () => void;
};

function queryValue(value: QueryValue): string {
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value ?? '');
}

function actionFrom(req: ApiRequest): string {
  const fromQuery = queryValue(req.query?.action);
  if (fromQuery) return fromQuery;
  const path = String(req.url ?? '').split('?')[0] ?? '';
  const parts = path.split('/').filter(Boolean);
  return parts[1] ?? parts[0] ?? '';
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
    res.status(204).end();
    return;
  }
  try {
    const action = actionFrom(req);
    const body = method === 'GET' ? {} : await readBody(req);
    const result = await handleStarterApi(method, `/api/${action}`, body);
    res.status(result.status).json(result.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ ok: false, error: message });
  }
}

export const config = {
  maxDuration: 60,
};
