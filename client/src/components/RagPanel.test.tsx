import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RagPanel from './RagPanel';
import { mockApi, renderPage } from '../test/render';

describe('RagPanel', () => {
  it('shows what the assistant looked up and the sources', async () => {
    const calls = mockApi({
      'POST /rag/agent': {
        answer: 'Use the retry helper [snippet:4].',
        citations: [{ snippetId: 4, title: 'Retry fetch with backoff', language: 'typescript' }],
        steps: [{ tool: 'search_vault', args: { query: 'retry http' }, found: 3 }, { tool: 'get_snippet', args: { id: 4 }, found: 1 }],
        stoppedEarly: false,
      },
    });
    const onCite = vi.fn();
    const user = userEvent.setup();
    renderPage(<RagPanel onCite={onCite} />);

    await user.type(screen.getByLabelText('Question'), 'how do we retry http calls?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(await screen.findByText(/Searched “retry http” · 3 found/)).toBeInTheDocument();
    expect(screen.getByText('Opened #4')).toBeInTheDocument();
    expect(calls[0]).toMatchObject({ method: 'POST', url: '/api/rag/agent', body: { question: 'how do we retry http calls?' } });

    await user.click(screen.getByRole('button', { name: /Retry fetch with backoff/ }));
    expect(onCite).toHaveBeenCalledWith(4);
  });
});
