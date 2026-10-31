import { describe, it, expect, vi, afterEach } from 'vitest';
import { app, request, newUser, newSnippet } from './helpers.js';
import { ollama } from '../src/ai/providers/index.ts';
import { cleanTag } from '../src/rag/autotag.ts';

const settle = () => new Promise(r => setTimeout(r, 50));
const tags = (u, body) => request(app).post('/api/assistant/tags').set('Authorization', u.auth).send(body);
const code = 'export async function retry(fn) { for (let i = 0; i < 3; i++) { try { return await fn(); } catch {} } }';

afterEach(() => vi.restoreAllMocks());

describe('tag suggestions', () => {
  it('suggests tags of similar snippets first, then from the model', async () => {
    const u = await newUser();
    const s = await newSnippet(u, { title: 'Retry helper', code });
    await request(app).post(`/api/tags/${s.id}`).set('Authorization', u.auth).send({ tag: 'resilience' });
    await settle();
    const res = await tags(u, { title: 'Retry again', language: 'python', code });
    expect(res.body[0]).toEqual({ tag: 'resilience', from: 'similar' });
    expect(res.body).toContainEqual({ tag: 'stub-tag', from: 'model' });
  });

  it('skips tags you have, the language name and vague words', async () => {
    const u = await newUser();
    const res = await tags(u, { title: 'x', language: 'python', code: 'print(1)', tags: ['stub-tag'] });
    expect(res.body).toEqual([]);
  });

  it('asks the model with a json schema', async () => {
    const u = await newUser();
    const spy = vi.spyOn(ollama, 'chat');
    await tags(u, { title: 'x', code: 'print(1)' });
    expect(spy.mock.calls[0][0].format).toMatchObject({ type: 'object', required: ['tags'] });
    expect(spy.mock.calls[0][0].temperature).toBe(0);
  });

  it('still answers when the model is down', async () => {
    const u = await newUser();
    vi.spyOn(ollama, 'chat').mockRejectedValue(new Error('connect ECONNREFUSED'));
    const res = await tags(u, { title: 'x', code: 'print(1)' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('cloud needs personal consent, code is required', async () => {
    const u = await newUser();
    await request(app).put('/api/ai/keys/openai').set('Authorization', u.auth).send({ apiKey: 'sk-test-0123456789', model: 'm' });
    await request(app).put('/api/ai/provider').set('Authorization', u.auth).send({ provider: 'openai' });
    expect((await tags(u, { title: 'x', code: 'print(1)' })).status).toBe(403);
    expect((await tags(u, { title: 'x' })).status).toBe(400);
  });

  it('cleans tag text', () => {
    expect(cleanTag('  #Date Parsing! ')).toBe('date-parsing');
    expect(cleanTag('C#')).toBe('c#');
    expect(cleanTag('x'.repeat(40))).toHaveLength(24);
  });
});
