import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SnippetEditor from './SnippetEditor';
import { mockApi, renderPage } from '../test/render';
import { generateKeyPair, openSealed } from '../lib/crypto';

describe('SnippetEditor', () => {
  it('creates a snippet and then adds its tags', async () => {
    const calls = mockApi({
      'GET /projects': [],
      'POST /snippets': (body: unknown) => ({ id: 7, ...(body as object), tags: [] }),
      'POST /tags/7': { ok: true },
    });
    const user = userEvent.setup();
    renderPage(<SnippetEditor />, { path: '/snippet/new' });

    await user.type(screen.getByPlaceholderText(/snippet title/i), 'Read env var');
    await user.type(screen.getByLabelText('code'), 'process.env.PORT');
    await user.type(screen.getByPlaceholderText(/add tag/i), 'Node{Enter}');
    expect(screen.getByText('node')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save snippet/i }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/snippet/7'));
    const create = calls.find(c => c.method === 'POST' && c.url === '/api/snippets');
    expect(create?.body).toMatchObject({ title: 'Read env var', code: 'process.env.PORT', language: 'javascript', visibility: 'private' });
    expect(calls.find(c => c.url === '/api/tags/7')?.body).toEqual({ tag: 'node' });
  });

  it('does not save without a title', async () => {
    const calls = mockApi({ 'GET /projects': [] });
    const user = userEvent.setup();
    renderPage(<SnippetEditor />, { path: '/snippet/new' });

    await user.type(screen.getByLabelText('code'), 'x');
    await user.click(screen.getByRole('button', { name: /save snippet/i }));

    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('removes a tag with backspace on empty input', async () => {
    mockApi({ 'GET /projects': [] });
    const user = userEvent.setup();
    renderPage(<SnippetEditor />, { path: '/snippet/new' });
    const input = screen.getByPlaceholderText(/add tag/i);
    await user.type(input, 'one{Enter}two{Enter}');
    await user.type(input, '{Backspace}');
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.queryByText('two')).not.toBeInTheDocument();
  });

  it('encrypts sensitive code in the browser before it is sent', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    localStorage.setItem('encPublicKey', publicKey);
    const calls = mockApi({
      'GET /projects': [],
      'POST /snippets': (body: unknown) => ({ id: 9, ...(body as object), tags: [] }),
    });
    const user = userEvent.setup();
    renderPage(<SnippetEditor />, { path: '/snippet/new' });

    await user.type(screen.getByPlaceholderText(/snippet title/i), 'Prod db password');
    await user.type(screen.getByLabelText('code'), 'hunter2-very-secret');
    await user.click(screen.getByRole('radio', { name: /sensitive/i }));
    await user.click(screen.getByRole('button', { name: /save snippet/i }));

    await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.url === '/api/snippets')).toBe(true));
    const sent = calls.find(c => c.url === '/api/snippets')?.body as { code: string; wrapped_key: string; encryption_mode: string };
    expect(sent.encryption_mode).toBe('sensitive');
    expect(sent.code).not.toContain('hunter2');
    expect(JSON.parse(sent.wrapped_key)).toEqual({ scheme: 'sealed', v: 1 });
    expect(await openSealed(sent.code, publicKey, privateKey)).toBe('hunter2-very-secret');
  });
});
