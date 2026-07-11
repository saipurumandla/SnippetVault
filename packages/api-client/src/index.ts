import type { NewSnippet, Project, Snippet, SnippetQuery } from './types.js';

export type * from './types.js';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ClientOptions {
  baseUrl: string;
  token?: string | (() => string | null | undefined);
  fetch?: typeof fetch;
}

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export function createClient({ baseUrl, token, fetch: fetchImpl }: ClientOptions) {
  // read global fetch late, tests and polyfills swap it
  const doFetch: typeof fetch = (input, init) => (fetchImpl ?? globalThis.fetch)(input, init);
  const root = baseUrl.replace(/\/+$/, '');

  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const t = typeof token === 'function' ? token() : token;
    if (t) headers.Authorization = `Bearer ${t}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await doFetch(`${root}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status === 204) return null as T;
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new ApiError(`Unexpected response from ${path} (${res.status})`, res.status);
    }
    if (!res.ok) {
      const message = (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
      throw new ApiError(message, res.status);
    }
    return data as T;
  }

  const qs = (params: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  return {
    request,
    snippets: {
      list: (query: SnippetQuery = {}) => request<Snippet[]>('GET', `/snippets${qs({ ...query })}`),
      get: (id: number) => request<Snippet>('GET', `/snippets/${id}`),
      create: (input: NewSnippet) => request<Snippet>('POST', '/snippets', input),
      update: (id: number, patch: Partial<NewSnippet>) => request<Snippet>('PUT', `/snippets/${id}`, patch),
      remove: (id: number) => request<null>('DELETE', `/snippets/${id}`),
      copied: (id: number) => request<{ ok: true }>('POST', `/snippets/${id}/copy`, {}),
    },
    tags: {
      list: () => request<string[]>('GET', '/tags'),
      add: (snippetId: number, tag: string) => request<{ ok: true }>('POST', `/tags/${snippetId}`, { tag }),
      remove: (snippetId: number, tag: string) => request<null>('DELETE', `/tags/${snippetId}/${encodeURIComponent(tag)}`),
    },
    projects: {
      list: () => request<Project[]>('GET', '/projects'),
    },
  };
}

export type VaultClient = ReturnType<typeof createClient>;
