import { describe, it, expect, vi } from 'vitest';
import { app, request, newUser, newSnippet } from './helpers.js';
import { runAgent, MAX_TOOL_CALLS, normalizeCitations } from '../src/ai/agent.ts';
import { GuardedProvider } from '../src/ai/cloud.ts';

const { callsInText } = await vi.importActual('../src/ai/providers/ollama.ts');
const settle = () => new Promise(r => setTimeout(r, 50));

function scripted(turns) {
  const seen = [];
  const provider = {
    id: 'ollama', cloud: false,
    async turn(req) {
      seen.push(structuredClone({ ...req, signal: undefined }));
      const next = turns.length > 1 ? turns.shift() : turns[0];
      return typeof next === 'function' ? next(req) : next;
    },
    chat: async () => '', stream: async () => {}, models: async () => [],
  };
  return { assistant: { provider, model: 'm' }, seen };
}

const call = (name, args, id = Math.random().toString(36).slice(2)) => ({ id, name, arguments: args });
const toolResults = req => req.messages.filter(m => m.role === 'tool').map(m => JSON.parse(m.content));

describe('assistant tool loop', () => {
  it('searches, reads, answers with citations', async () => {
    const u = await newUser();
    const s = await newSnippet(u, { title: 'Retry with backoff', code: 'export function retry() { /* backoff */ }' });
    await settle();
    const { assistant, seen } = scripted([
      { text: '', toolCalls: [call('search_vault', { query: 'retry backoff' })] },
      { text: '', toolCalls: [call('get_snippet', { id: s.id })] },
      { text: `Use this one [snippet:${s.id}].`, toolCalls: [] },
    ]);
    const res = await runAgent(assistant, u.id, 'how do I retry?');
    expect(res.citations).toEqual([{ snippetId: s.id, title: 'Retry with backoff', language: 'javascript' }]);
    expect(res.steps.map(x => x.tool)).toEqual(['search_vault', 'get_snippet']);
    expect(toolResults(seen[2])[1].code).toContain('backoff');
    expect(seen[2].sourceIds).toEqual([s.id]);
  });

  it(`stops after ${MAX_TOOL_CALLS} tool calls and forces an answer`, async () => {
    const u = await newUser();
    await newSnippet(u, { title: 'Loop helper', code: 'loop forever helper' });
    await settle();
    const { assistant, seen } = scripted([req => ({ text: '', toolCalls: req.tools ? [call('search_vault', { query: 'loop' }), call('search_vault', { query: 'helper' })] : [] })]);
    const res = await runAgent(assistant, u.id, 'loop?');
    expect(res.steps).toHaveLength(MAX_TOOL_CALLS);
    expect(res.stoppedEarly).toBe(true);
    expect(seen.at(-1).tools).toBeUndefined();
    expect(seen).toHaveLength(MAX_TOOL_CALLS / 2 + 1);
  });

  it('only counts citations of snippets the tools gave', async () => {
    const u = await newUser();
    const other = await newUser();
    const hidden = await newSnippet(other, { title: 'Not yours' });
    const { assistant } = scripted([{ text: `See [snippet:${hidden.id}]`, toolCalls: [] }]);
    const res = await runAgent(assistant, u.id, 'anything');
    expect(res.citations).toEqual([]);
  });

  it('never returns sensitive or other peoples private snippets from tools', async () => {
    const u = await newUser();
    const other = await newUser();
    const secret = await newSnippet(u, { title: 'prod db password', encryption_mode: 'sensitive', wrapped_key: 'sealed', code: 'Y2lwaGVy' });
    const theirs = await newSnippet(other, { title: 'prod db password other' });
    const { assistant, seen } = scripted([
      { text: '', toolCalls: [call('get_snippet', { id: secret.id }), call('get_snippet', { id: theirs.id }), call('search_vault', { query: 'prod db password' })] },
      { text: 'nothing', toolCalls: [] },
    ]);
    const res = await runAgent(assistant, u.id, 'prod password?');
    const results = toolResults(seen[1]);
    expect(results[0].error).toBeTruthy();
    expect(results[1].error).toBeTruthy();
    expect(JSON.stringify(results)).not.toMatch(/Y2lwaGVy|prod db password/);
    expect(res.answer).toMatch(/No snippets in your vault match/);
  });

  it('cloud model only sees snippets with consent, guard still checks', async () => {
    const u = await newUser();
    const p = (await request(app).post('/api/projects').set('Authorization', u.auth).send({ name: 'closed' })).body;
    await newSnippet(u, { title: 'Cache helper closed', code: 'cache helper closed', project_id: p.id, visibility: 'project' });
    const open = await newSnippet(u, { title: 'Cache helper open', code: 'cache helper open' });
    await request(app).put('/api/ai/consent').set('Authorization', u.auth).send({ provider: 'anthropic', projectId: null, allow: true });
    await settle();
    const sent = [];
    const inner = {
      id: 'anthropic', cloud: true, chat: async () => '', stream: async () => {}, models: async () => [],
      turn: async req => { sent.push(req); return sent.length === 1 ? { text: '', toolCalls: [call('search_vault', { query: 'cache helper' })] } : { text: `[snippet:${open.id}]`, toolCalls: [] }; },
    };
    const res = await runAgent({ provider: new GuardedProvider(inner), model: 'm' }, u.id, 'cache?');
    expect(JSON.stringify(sent[1].messages)).not.toContain('closed');
    expect(res.citations.map(c => c.snippetId)).toEqual([open.id]);
  });

  it('gives up after the timeout', async () => {
    const u = await newUser();
    const { assistant } = scripted([req => new Promise((_, reject) => req.signal.addEventListener('abort', () => reject(req.signal.reason)))]);
    const started = Date.now();
    await expect(runAgent(assistant, u.id, 'slow?', { timeoutMs: 30 })).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('model that skips the tools', () => {
  it('still searches with the question before answering', async () => {
    const u = await newUser();
    const s = await newSnippet(u, { title: 'Graceful shutdown', code: 'srv.Shutdown(ctx) on interrupt' });
    await settle();
    const { assistant, seen } = scripted([
      { text: 'From memory: call srv.Shutdown.', toolCalls: [] },
      { text: `Use this [snippet:${s.id}].`, toolCalls: [] },
    ]);
    const res = await runAgent(assistant, u.id, 'graceful shutdown');
    expect(res.steps[0]).toMatchObject({ tool: 'search_vault', args: { query: 'graceful shutdown' } });
    expect(res.citations.map(c => c.snippetId)).toEqual([s.id]);
    expect(seen[1].messages.some(m => m.role === 'assistant' && m.content.includes('From memory'))).toBe(false);
  });
});

describe('route', () => {
  it('answers through the local model and checks input', async () => {
    const u = await newUser();
    expect((await request(app).post('/api/rag/agent').set('Authorization', u.auth).send({ question: '' })).status).toBe(400);
    expect((await request(app).post('/api/rag/agent').set('Authorization', u.auth).send({ question: 'x'.repeat(2001) })).status).toBe(400);
    const res = await request(app).post('/api/rag/agent').set('Authorization', u.auth).send({ question: 'anything about retry?' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('steps');
  });
});

describe('tool calls written as text', () => {
  it('reads qwen style calls and cleans the text', () => {
    const out = callsInText('Let me look.\n<function=search_vault>\n<parameter=query>\nhttp retry\n</parameter>\n</function>\n</tool_call>');
    expect(out.calls).toEqual([{ name: 'search_vault', arguments: { query: 'http retry' } }]);
    expect(out.text).toBe('Let me look.');
    expect(callsInText('<function=get_snippet><parameter=id>12</parameter></function>').calls[0].arguments).toEqual({ id: 12 });
    expect(callsInText('no calls here').text).toBe('no calls here');
  });
});

describe('citation format', () => {
  it('fixes near misses only for snippets the tools returned', () => {
    const seen = new Map([[3, {}], [7, {}]]);
    expect(normalizeCitations('see snippet [3] and [#7], also [snippet 3]', seen)).toBe('see [snippet:3] and [snippet:7], also [snippet:3]');
    expect(normalizeCitations('made up snippet [99] and [#42]', seen)).toBe('made up snippet [99] and [#42]');
  });
});
