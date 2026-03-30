import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Vault from './Vault';
import { mockApi, renderPage } from '../test/render';

const snippet = (id: number, title: string, language: string, tags: string[] = []) => ({
  id, title, language, tags, code: `// ${title}`, description: null, visibility: 'private', encryption_mode: 'standard',
  wrapped_key: null, project_id: null, author_id: 1, copy_count: 0, is_favourite: 0, expires_at: null, expired_at: null,
  created_at: '2026-03-01T10:00:00Z', updated_at: '2026-03-01T10:00:00Z',
});

const rows = () => within(screen.getByRole('listbox', { name: 'Snippets' })).getAllByRole('option');

const list = [snippet(1, 'Parse csv rows', 'python', ['parsing']), snippet(2, 'Retry fetch', 'javascript', ['http'])];

describe('Vault', () => {
  it('lists snippets from the api', async () => {
    mockApi({ 'GET /snippets': list, 'GET /projects': [], 'GET /tags': ['http', 'parsing'] });
    renderPage(<Vault />, { path: '/vault' });
    expect(await screen.findByText('Parse csv rows')).toBeInTheDocument();
    expect(screen.getByText('Retry fetch')).toBeInTheDocument();
    expect(screen.getByText('2 snippets')).toBeInTheDocument();
  });

  it('asks the api again when a language is picked', async () => {
    const calls = mockApi({ 'GET /snippets': list, 'GET /projects': [], 'GET /tags': [] });
    const user = userEvent.setup();
    renderPage(<Vault />, { path: '/vault' });
    await screen.findByText('Parse csv rows');
    await user.selectOptions(screen.getByLabelText('Language'), 'python');
    await waitFor(() => expect(calls.some(c => c.url === '/api/snippets?language=python')).toBe(true));
  });

  it('uses the tag from the url', async () => {
    mockApi({ 'GET /snippets': list, 'GET /projects': [], 'GET /tags': ['http', 'parsing'] });
    renderPage(<Vault />, { path: '/vault?tag=http' });
    expect(await screen.findByText('Retry fetch')).toBeInTheDocument();
    expect(screen.queryByText('Parse csv rows')).not.toBeInTheDocument();
  });

  it('previews the first snippet and moves with arrow keys', async () => {
    mockApi({ 'GET /snippets': list, 'GET /projects': [], 'GET /tags': [] });
    const user = userEvent.setup();
    renderPage(<Vault />, { path: '/vault' });
    await screen.findByText('// Parse csv rows');
    const options = rows();
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');
    expect(screen.getByText('// Retry fetch')).toBeInTheDocument();
    expect(rows()[1]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/snippet/2'));
  });

  it('arrow keys do nothing while typing in search', async () => {
    mockApi({ 'GET /snippets': list, 'GET /projects': [], 'GET /tags': [] });
    const user = userEvent.setup();
    renderPage(<Vault />, { path: '/vault' });
    await screen.findByText('// Parse csv rows');
    await user.click(screen.getByLabelText('Search snippets'));
    await user.keyboard('{ArrowDown}');
    expect(rows()[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('hides code of sensitive snippets in the preview', async () => {
    const secret = { ...snippet(3, 'Prod db password', 'plaintext'), encryption_mode: 'sensitive', code: 'CIPHERTEXT' };
    mockApi({ 'GET /snippets': [secret], 'GET /projects': [], 'GET /tags': [] });
    renderPage(<Vault />, { path: '/vault' });
    expect(await screen.findByText(/encrypted in your browser/i)).toBeInTheDocument();
    expect(screen.queryByText('CIPHERTEXT')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy code/i })).not.toBeInTheDocument();
  });

  it('shows empty state', async () => {
    mockApi({ 'GET /snippets': [], 'GET /projects': [], 'GET /tags': [] });
    renderPage(<Vault />, { path: '/vault' });
    expect(await screen.findByText(/vault is empty/i)).toBeInTheDocument();
  });
});
