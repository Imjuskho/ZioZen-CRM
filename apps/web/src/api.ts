const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

export function getToken(): string | null {
  return localStorage.getItem('ziozen_access_token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('ziozen_access_token', token);
  else localStorage.removeItem('ziozen_access_token');
}

export function getPortalToken(): string | null {
  return localStorage.getItem('ziozen_portal_token');
}

export function setPortalToken(token: string | null) {
  if (token) localStorage.setItem('ziozen_portal_token', token);
  else localStorage.removeItem('ziozen_portal_token');
}

export type RequestOptions = RequestInit & { json?: unknown };

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, options, getToken());
}

export async function portalApi<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, options, getPortalToken());
}

async function request<T>(path: string, options: RequestOptions, token: string | null): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  });

  if (!response.ok) {
    const body = await response.text();
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string | string[] } | string; message?: string; requestId?: string; code?: string };
      const nested = typeof parsed.error === 'object' && parsed.error ? parsed.error.message : parsed.error;
      const message = Array.isArray(nested) ? nested.join(', ') : nested || parsed.message || response.statusText;
      const suffix = parsed.requestId ? ` (request ${parsed.requestId})` : '';
      throw new Error(`${message}${suffix}`);
    } catch (error) {
      if (error instanceof Error && error.message !== body) throw error;
      throw new Error(body || response.statusText);
    }
  }

  return response.json() as Promise<T>;
}
