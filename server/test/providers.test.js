import { describe, it, expect, vi, afterEach } from 'vitest';
import http from 'node:http';
import { once } from 'node:events';
import { AnthropicProvider } from '../src/ai/providers/anthropic.ts';
import { OpenAIProvider } from '../src/ai/providers/openai.ts';
import { cloudProvider, localModel } from '../src/ai/providers/index.ts';

const { OllamaProvider } = await vi.importActual('../src/ai/providers/ollama.ts');

const servers = [];
afterEach(() => servers.splice(0).forEach(s => s.close()));

async function fakeOllama(handler) {
  const seen = [];
  const srv = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    seen.push({ path: req.url, body: body ? JSON.parse(body) : null });
    handler(req, res);
  });
  srv.listen(0, '127.0.0.1');
  await once(srv, 'listening');
  servers.push(srv);
  return { url: `http://127.0.0.1:${srv.address().port}`, seen };
}

function fakeFetch(respond) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body ?? 'null') });
    return respond(String(url));
  };
  return { fn, calls };
}

const json = data => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
const sse = events => new Response(events.map(e => `${e.event ? `event: ${e.event}\n` : ''}data: ${typeof e.data === 'string' ? e.data : JSON.stringify(e.data)}\n\n`).join(''), {
  status: 200, headers: { 'content-type': 'text/event-stream' },
});

describe('ollama provider', () => {
  it('chats and clamps temperature', async () => {
    const o = await fakeOllama((req, res) => res.end(JSON.stringify({ message: { content: 'hi there' }, done: true })));
    const p = new OllamaProvider(o.url);
    const out = await p.chat({ model: 'qwen3-coder:30b', messages: [{ role: 'user', content: 'hi' }], temperature: 1.5 });
    expect(out).toBe('hi there');
    expect(o.seen[0]).toMatchObject({ path: '/api/chat', body: { stream: false, options: { temperature: 0.7 } } });
  });

  it('streams even when a json line is cut between chunks', async () => {
    const o = await fakeOllama((req, res) => {
      res.write('{"message":{"content":"Hel"}}\n{"message":{"con');
      setTimeout(() => res.end('tent":"lo"}}\n{"done":true}\n'), 20);
    });
    const tokens = [];
    await new OllamaProvider(o.url).stream({ model: 'm', messages: [{ role: 'user', content: 'x' }] }, t => tokens.push(t));
    expect(tokens).toEqual(['Hel', 'lo']);
  });

  it('lists installed models, empty when ollama is down', async () => {
    const o = await fakeOllama((req, res) => res.end(JSON.stringify({ models: [{ name: 'qwen3-coder:30b' }, { name: 'llama3.1:8b' }] })));
    expect(await new OllamaProvider(o.url).models()).toEqual(['qwen3-coder:30b', 'llama3.1:8b']);
    expect(await new OllamaProvider('http://127.0.0.1:9').models()).toEqual([]);
  });

  it('passes ollama errors on', async () => {
    const o = await fakeOllama((req, res) => { res.statusCode = 404; res.end('{"error":"model not found"}'); });
    await expect(new OllamaProvider(o.url).chat({ model: 'nope', messages: [] })).rejects.toThrow(/404.*model not found/);
  });
});

describe('anthropic provider', () => {
  it('sends system apart, key in header, reads text blocks', async () => {
    const f = fakeFetch(() => json({
      id: 'msg_1', type: 'message', role: 'assistant', model: 'm', stop_reason: 'end_turn', stop_sequence: null,
      content: [{ type: 'text', text: 'Use ' }, { type: 'text', text: 'retry.' }],
      usage: { input_tokens: 5, output_tokens: 2 },
    }));
    const p = new AnthropicProvider('sk-test-key', f.fn);
    const out = await p.chat({ model: 'some-model', temperature: 0.9, messages: [
      { role: 'system', content: 'be short' }, { role: 'user', content: 'how to retry?' },
    ] });
    expect(out).toBe('Use retry.');
    expect(f.calls[0].url).toMatch(/\/v1\/messages$/);
    expect(f.calls[0].headers.get('x-api-key')).toBe('sk-test-key');
    expect(f.calls[0].body).toMatchObject({ model: 'some-model', system: 'be short', temperature: 0.7, max_tokens: 2048,
      messages: [{ role: 'user', content: 'how to retry?' }] });
  });

  it('streams text deltas', async () => {
    const f = fakeFetch(() => sse([
      { event: 'message_start', data: { type: 'message_start', message: { id: 'm1', type: 'message', role: 'assistant', model: 'm', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } } },
      { event: 'content_block_start', data: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } },
      { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hel' } } },
      { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'lo' } } },
      { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
      { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 2 } } },
      { event: 'message_stop', data: { type: 'message_stop' } },
    ]));
    const tokens = [];
    await new AnthropicProvider('k', f.fn).stream({ model: 'm', messages: [{ role: 'user', content: 'x' }] }, t => tokens.push(t));
    expect(tokens).toEqual(['Hel', 'lo']);
  });
});

describe('openai provider', () => {
  it('chats with bearer key', async () => {
    const f = fakeFetch(() => json({
      id: 'c1', object: 'chat.completion', created: 0, model: 'm',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'done', refusal: null } }],
    }));
    const out = await new OpenAIProvider('sk-o', f.fn).chat({ model: 'some-model', messages: [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }] });
    expect(out).toBe('done');
    expect(f.calls[0].url).toMatch(/\/chat\/completions$/);
    expect(f.calls[0].headers.get('authorization')).toBe('Bearer sk-o');
    expect(f.calls[0].body.messages).toEqual([{ role: 'system', content: 's' }, { role: 'user', content: 'u' }]);
  });

  it('streams deltas until done', async () => {
    const chunk = content => ({ id: 'c', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta: { content }, finish_reason: null }] });
    const f = fakeFetch(() => sse([{ data: chunk('a') }, { data: chunk('b') }, { data: '[DONE]' }]));
    const tokens = [];
    await new OpenAIProvider('k', f.fn).stream({ model: 'm', messages: [{ role: 'user', content: 'x' }] }, t => tokens.push(t));
    expect(tokens).toEqual(['a', 'b']);
  });
});

describe('provider registry', () => {
  it('needs a key for cloud', () => {
    expect(() => cloudProvider('anthropic', '')).toThrow(/No API key/);
    expect(cloudProvider('openai', 'k').cloud).toBe(true);
  });

  it('only allows models ollama has installed', async () => {
    await expect(localModel('qwen3-coder:30b')).resolves.toBe('qwen3-coder:30b');
    await expect(localModel()).resolves.toBe('qwen3-coder:30b');
    await expect(localModel('../../etc/passwd')).rejects.toThrow(/not installed/);
  });
});
