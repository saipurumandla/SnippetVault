import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tokens from './Tokens';
import { mockApi, renderPage } from '../test/render';

const existing = [{ id: 1, name: 'old laptop', prefix: 'sv_abc1234', scopes: ['read'], created_at: '2026-04-01T10:00:00Z', last_used_at: null, revoked_at: null }];

describe('Tokens page', () => {
  it('shows a new token once and sends chosen scopes', async () => {
    const calls = mockApi({
      'GET /tokens': existing,
      'POST /tokens': (body: unknown) => ({ id: 2, prefix: 'sv_new0000', created_at: '2026-04-11T10:00:00Z', last_used_at: null, revoked_at: null, ...(body as object), token: 'sv_new0000-full-secret' }),
    });
    const user = userEvent.setup();
    renderPage(<Tokens />, { path: '/tokens' });
    expect(await screen.findByText('old laptop')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /new token/i }));
    await user.type(screen.getByLabelText(/name/i), 'work laptop');
    await user.click(screen.getByRole('checkbox', { name: /propose/i }));
    await user.click(screen.getByRole('button', { name: /create token/i }));

    expect(await screen.findByText('sv_new0000-full-secret')).toBeInTheDocument();
    expect(screen.getByText(/won't see it again/i)).toBeInTheDocument();
    expect(calls.find(c => c.method === 'POST')?.body).toEqual({ name: 'work laptop', scopes: ['read', 'propose'] });

    await user.click(screen.getByRole('button', { name: /done/i }));
    await waitFor(() => expect(screen.queryByText('sv_new0000-full-secret')).not.toBeInTheDocument());
  });

  it('needs a name and a scope', async () => {
    const calls = mockApi({ 'GET /tokens': [] });
    const user = userEvent.setup();
    renderPage(<Tokens />, { path: '/tokens' });
    await user.click(await screen.findByRole('button', { name: /new token/i }));
    await user.click(screen.getByRole('button', { name: /create token/i }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/name/i), 'x');
    await user.click(screen.getByRole('checkbox', { name: /read/i }));
    await user.click(screen.getByRole('button', { name: /create token/i }));
    expect(screen.getByText('Pick at least one scope')).toBeInTheDocument();
    expect(calls.some(c => c.method === 'POST')).toBe(false);
  });
});
