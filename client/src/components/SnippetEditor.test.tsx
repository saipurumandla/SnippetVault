import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SnippetEditor from './SnippetEditor';
import { mockApi, renderPage } from '../test/render';

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
});
