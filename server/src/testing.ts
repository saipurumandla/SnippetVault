import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

export interface TestServer {
  url: string;
  email: string;
  jwt: string;
  token: string;
  readToken: string;
  api<T = unknown>(path: string, body?: unknown, auth?: string, method?: string): Promise<T>;
  close(): Promise<void>;
}

// real server on a free port, for cli and editor tests
export async function startTestServer(): Promise<TestServer> {
  process.env.DB_PATH ??= ':memory:';
  process.env.JWT_SECRET ??= 'test-secret';
  process.env.LOG_LEVEL ??= 'silent';
  process.env.EMBEDDINGS = 'off';
  const { default: app } = await import('./app.js');

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function api<T>(path: string, body?: unknown, auth?: string, method?: string): Promise<T> {
    const res = await fetch(`${url}/api${path}`, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
    return (res.status === 204 ? null : await res.json()) as T;
  }

  const email = `dev${Date.now()}@example.com`;
  const { token: jwt } = await api<{ token: string }>('/auth/register', { email, password: 'test-password-1' });
  const { token } = await api<{ token: string }>('/tokens', { name: 'test write', scopes: ['read', 'write'] }, jwt);
  const { token: readToken } = await api<{ token: string }>('/tokens', { name: 'test read', scopes: ['read'] }, jwt);

  return {
    url, email, jwt, token, readToken, api,
    close: () => new Promise(resolve => server.close(() => resolve())),
  };
}
