import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommandPalette from './CommandPalette';
import { mockApi, renderPage } from '../test/render';

const routes = {
  'GET /snippets': [{ id: 4, title: 'Parse csv rows', language: 'python', tags: [] }],
  'GET /projects': [{ id: 2, name: 'Payments' }],
  'GET /tags': ['parsing'],
};

describe('CommandPalette', () => {
  it('opens with ctrl+k and closes with escape', async () => {
    mockApi(routes);
    const user = userEvent.setup();
    renderPage(<CommandPalette />, { path: '/vault' });
    expect(screen.queryByPlaceholderText(/search snippets/i)).not.toBeInTheDocument();
    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByPlaceholderText(/search snippets/i)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByPlaceholderText(/search snippets/i)).not.toBeInTheDocument();
  });

  it('filters and opens a snippet with enter', async () => {
    mockApi(routes);
    const user = userEvent.setup();
    renderPage(<CommandPalette />, { path: '/vault' });
    await user.keyboard('{Control>}k{/Control}');
    await screen.findByText('Parse csv rows');
    await user.type(screen.getByPlaceholderText(/search snippets/i), 'csv');
    expect(screen.queryByText('Payments')).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/snippet/4'));
  });

  it('runs an action with arrow keys', async () => {
    mockApi({ 'GET /snippets': [], 'GET /projects': [], 'GET /tags': [] });
    const user = userEvent.setup();
    renderPage(<CommandPalette />, { path: '/vault' });
    await user.keyboard('{Control>}k{/Control}');
    await user.type(await screen.findByPlaceholderText(/search snippets/i), 'settings');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/settings'));
  });
});
