async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const raw = await response.text();
  let data: (T & { error?: string; fix?: string }) | undefined;
  try {
    data = raw ? (JSON.parse(raw) as T & { error?: string; fix?: string }) : undefined;
  } catch {
    throw new Error(
      `API ${url} returned ${response.status} instead of JSON. Redeploy so /api is a serverless function.`,
    );
  }
  if (!response.ok) {
    throw new Error(
      data?.fix ? `${data.error} — ${data.fix}` : data?.error || `Request failed (${response.status})`,
    );
  }
  return (data ?? ({} as T)) as T;
}

export function getJson<T>(url: string): Promise<T> {
  return request<T>(url);
}

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
