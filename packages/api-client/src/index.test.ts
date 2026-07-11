import { describe, it, expect, vi } from 'vitest';
import { createClient, ApiError } from './index.js';

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(body === null ? null : JSON.stringify(body), { status }));
}

describe('api client', () => {
  it('sends the token and builds query strings', async () => {
    const f = fakeFetch(200, []);
    const vault = createClient({ baseUrl: 'http://vault.local/api/', token: 'sv_abc', fetch: f });
    await vault.snippets.list({ q: 'retry http', language: 'go', project_id: undefined });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://vault.local/api/snippets?q=retry+http&language=go');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer sv_abc');
  });

  it('reads the token lazily', async () => {
    const f = fakeFetch(200, []);
    let token: string | null = null;
    const vault = createClient({ baseUrl: '/api', token: () => token, fetch: f });
    await vault.tags.list();
    token = 'later';
    await vault.tags.list();
    expect((f.mock.calls[0]![1]!.headers as Record<string, string>).Authorization).toBeUndefined();
    expect((f.mock.calls[1]![1]!.headers as Record<string, string>).Authorization).toBe('Bearer later');
  });

  it('turns error bodies into ApiError with status', async () => {
    const vault = createClient({ baseUrl: '/api', fetch: fakeFetch(403, { error: 'Forbidden' }) });
    const err = await vault.snippets.get(3).catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ message: 'Forbidden', status: 403 });
  });

  it('handles 204 and non json answers', async () => {
    expect(await createClient({ baseUrl: '/api', fetch: fakeFetch(204, null) }).snippets.remove(1)).toBeNull();
    const html = vi.fn(async () => new Response('<html>proxy error</html>', { status: 502 }));
    await expect(createClient({ baseUrl: '/api', fetch: html }).tags.list()).rejects.toThrow('Unexpected response');
  });

  it('encodes tags in paths and json bodies', async () => {
    const f = fakeFetch(200, { ok: true });
    const vault = createClient({ baseUrl: '/api', fetch: f });
    await vault.tags.add(4, 'c#');
    await vault.tags.remove(4, 'c#/net');
    expect(f.mock.calls[0]![1]!.body).toBe('{"tag":"c#"}');
    expect(f.mock.calls[1]![0]).toBe('/api/tags/4/c%23%2Fnet');
  });
});
