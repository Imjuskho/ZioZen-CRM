import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, setToken } from './api';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
  configurable: true,
});

afterEach(() => {
  vi.restoreAllMocks();
  storage.clear();
});

describe('frontend API contract', () => {
  it('sends JSON and the bearer token, then returns the decoded response', async () => {
    setToken('test-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'customer-1' }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(api<{ id: string }>('/customers', { method: 'POST', json: { name: 'Acme' } })).resolves.toEqual({ id: 'customer-1' });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/customers', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'Acme' }),
      headers: expect.any(Headers),
    }));
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer test-token');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('turns a structured API error into a readable message with its request ID', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'REQUEST_INVALID', requestId: 'req-123', error: { message: ['departmentId must be a string'] } }), { status: 400 }));

    await expect(api('/customers', { method: 'POST', json: {} })).rejects.toThrow('departmentId must be a string (request req-123)');
  });

  it('preserves the server message when an error payload is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Gateway unavailable', { status: 502 }));

    await expect(api('/health/ready')).rejects.toThrow('Gateway unavailable');
  });
});
