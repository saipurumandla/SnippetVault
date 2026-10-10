import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssistantSettings from './AssistantSettings';
import { mockApi, renderPage } from '../test/render';
import type { AiSettings } from '../types';

const base: AiSettings = {
  provider: 'ollama', canStoreKeys: true, keys: [], personalConsent: [], projects: [], localModels: ['qwen3-coder:30b'],
};

describe('AssistantSettings', () => {
  it('cloud stays off until a key is saved', async () => {
    let state = base;
    const calls = mockApi({
      'GET /ai': () => state,
      'PUT /ai/keys/anthropic': (body: unknown) => {
        state = { ...state, keys: [{ provider: 'anthropic', last4: 'wxyz', model: (body as { model: string }).model, updated_at: '' }] };
        return { ok: true };
      },
    });
    const user = userEvent.setup();
    renderPage(<AssistantSettings />);

    expect(await screen.findByText(/1 installed: qwen3-coder:30b/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /anthropic/i })).toBeDisabled();

    const form = screen.getByRole('form', { name: /anthropic key/i });
    await user.type(within(form).getByLabelText(/api key/i), 'sk-test-0123456789-wxyz');
    await user.type(within(form).getByLabelText(/model/i), 'my-model');
    await user.click(within(form).getByRole('button', { name: /save anthropic/i }));

    expect(calls.find(c => c.method === 'PUT')?.body).toEqual({ apiKey: 'sk-test-0123456789-wxyz', model: 'my-model' });
    await waitFor(() => expect(screen.getByRole('radio', { name: /anthropic/i })).toBeEnabled());
    expect(screen.getByText('key ending wxyz')).toBeInTheDocument();
    expect(within(form).getByLabelText(/api key/i)).toHaveValue('');
  });

  it('says sensitive never leaves, and why keys cant be saved', async () => {
    mockApi({ 'GET /ai': { ...base, canStoreKeys: false } });
    renderPage(<AssistantSettings />);
    expect(await screen.findByText(/sensitive snippets never go to a cloud model/i)).toBeInTheDocument();
    expect(screen.getByText(/MASTER_KEY/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /save/i }).every(b => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  it('personal consent is a separate choice', async () => {
    const calls = mockApi({ 'GET /ai': base, 'PUT /ai/consent': { ok: true } });
    const user = userEvent.setup();
    renderPage(<AssistantSettings />);
    await user.click(await screen.findByRole('checkbox', { name: 'OpenAI' }));
    expect(calls.find(c => c.url === '/api/ai/consent')?.body).toEqual({ provider: 'openai', projectId: null, allow: true });
  });
});
