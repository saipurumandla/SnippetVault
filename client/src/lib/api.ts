import { vault } from './vault';

export const api = {
  post: <T = unknown>(path: string, body: unknown) => vault.request<T>('POST', path, body),
  get: <T = unknown>(path: string) => vault.request<T>('GET', path),
  put: <T = unknown>(path: string, body: unknown) => vault.request<T>('PUT', path, body),
  del: <T = unknown>(path: string) => vault.request<T>('DELETE', path),
};
