import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Drafts from './Drafts';
import { mockApi, renderPage } from '../test/render';

const draft = (id: number, title: string, extra = {}) => ({
  id, title, source: 'cursor', description: null, code: `// ${title}`, language: 'typescript', tags: ['async'],
  status: 'pending', snippet_id: null, created_at: '2026-05-10T10:00:00Z', possible_secret: false, ...extra,
});

describe('Drafts page', () => {
  it('previews a draft and accepts it', async () => {
    let list = [draft(1, 'Sleep helper'), draft(2, 'Leaky config', { possible_secret: true })];
    const calls = mockApi({
      'GET /drafts': () => list,
      'POST /drafts/1/accept': () => { list = list.filter(d => d.id !== 1); return { snippet_id: 40 }; },
    });
    const user = userEvent.setup();
    renderPage(<Drafts />, { path: '/drafts' });
    expect(await screen.findByText('// Sleep helper')).toBeInTheDocument();
    expect(screen.getByText(/2 waiting/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^accept$/i }));
    await waitFor(() => expect(screen.getByText('// Leaky config')).toBeInTheDocument());
    expect(calls.some(c => c.method === 'POST' && c.url === '/api/drafts/1/accept')).toBe(true);
    expect(screen.getByRole('alert')).toHaveTextContent(/secret/i);
  });

  it('edit then accept opens the editor with the draft', async () => {
    mockApi({ 'GET /drafts': [draft(5, 'Retry helper')] });
    const user = userEvent.setup();
    renderPage(<Drafts />, { path: '/drafts' });
    await user.click(await screen.findByRole('button', { name: /edit, then accept/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/snippet/new?draft=5');
  });

  it('explains the empty queue', async () => {
    mockApi({ 'GET /drafts': [] });
    renderPage(<Drafts />, { path: '/drafts' });
    expect(await screen.findByText(/nothing to review/i)).toBeInTheDocument();
  });
});
