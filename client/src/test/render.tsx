import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import ToastContainer from '../components/Toast';

type Handler = (body: unknown) => unknown;
export type Routes = Record<string, Handler | unknown>;

export function mockApi(routes: Routes) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    const path = url.replace(/^\/api/, '').split('?')[0];
    const key = Object.keys(routes).find(k => k === `${method} ${path}` || k === `${method} ${url.replace(/^\/api/, '')}`);
    if (!key) return new Response(JSON.stringify({ error: `no mock for ${method} ${url}` }), { status: 404 });
    const value = routes[key];
    const data = typeof value === 'function' ? (value as Handler)(body) : value;
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

function Location() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

export function renderPage(ui: ReactNode, { path = '/', route = '*' } = {}) {
  localStorage.setItem('token', 'test-token');
  return render(
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={route} element={ui} />
              <Route path="*" element={null} />
            </Routes>
            <Location />
          </MemoryRouter>
          <ToastContainer />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
}
