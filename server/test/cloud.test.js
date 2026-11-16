import { describe, it, expect, vi, afterEach } from 'vitest';
import { app, request, newUser, newSnippet } from './helpers.js';
import db from '../src/db.ts';
import { config } from '../src/config.ts';
import { GuardedProvider, CloudBlocked } from '../src/ai/cloud.ts';
import { DEFAULT_MODEL } from '../src/ai/providers/index.ts';

const KEY = 'sk-test-0123456789-wxyz';
const STRIPE = process.env.TEST_STRIPE_LIVE_KEY;

afterEach(() => vi.unstubAllGlobals());

function cloudFetch() {
  const calls = [];
  vi.stubGlobal('fetch', async (url, init) => {
    calls.push({ url: String(url), headers: new Headers(init.headers), body: init.body ? String(init.body) : '' });
    return new Response(JSON.stringify({
      id: 'msg', type: 'message', role: 'assistant', model: 'm', stop_reason: 'end_turn', stop_sequence: null,
      content: [{ type: 'text', text: 'cloud says hi' }], usage: { input_tokens: 1, output_tokens: 1 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return calls;
}

async function cloudUser() {
  const u = await newUser();
  await request(app).put('/api/ai/keys/anthropic').set('Authorization', u.auth).send({ apiKey: KEY, model: 'some-model' }).expect(200);
  await request(app).put('/api/ai/provider').set('Authorization', u.auth).send({ provider: 'anthropic' }).expect(200);
  return u;
}

const consent = (u, body) => request(app).put('/api/ai/consent').set('Authorization', u.auth).send({ provider: 'anthropic', projectId: null, allow: true, ...body });
const settle = () => new Promise(r => setTimeout(r, 50));

describe('api keys', () => {
  it('keeps the key sealed and never sends it back', async () => {
    const u = await cloudUser();
    const res = await request(app).get('/api/ai').set('Authorization', u.auth);
    expect(res.body.provider).toBe('anthropic');
    expect(res.body.keys).toEqual([expect.objectContaining({ provider: 'anthropic', last4: 'wxyz', model: 'some-model' })]);
    expect(JSON.stringify(res.body)).not.toContain(KEY);
    expect(JSON.stringify(db.prepare('SELECT * FROM ai_keys WHERE user_id = ?').get(u.id))).not.toContain(KEY);
  });

  it('refuses keys without MASTER_KEY, and cloud without a key', async () => {
    const u = await newUser();
    const saved = config.masterKey;
    config.masterKey = '';
    try {
      const res = await request(app).put('/api/ai/keys/openai').set('Authorization', u.auth).send({ apiKey: KEY, model: 'm' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/MASTER_KEY/);
    } finally {
      config.masterKey = saved;
    }
    expect((await request(app).put('/api/ai/provider').set('Authorization', u.auth).send({ provider: 'openai' })).status).toBe(400);
  });

  it('removing the key goes back to local', async () => {
    const u = await cloudUser();
    await request(app).delete('/api/ai/keys/anthropic').set('Authorization', u.auth).expect(204);
    expect((await request(app).get('/api/ai').set('Authorization', u.auth)).body.provider).toBe('ollama');
  });
});

describe('active model', () => {
  it('reports what the assistant will really use', async () => {
    const u = await newUser();
    const local = await request(app).get('/api/assistant/models').set('Authorization', u.auth);
    expect(local.body).toMatchObject({ available: true, active: { provider: 'ollama', model: DEFAULT_MODEL } });
    const c = await cloudUser();
    const cloud = await request(app).get('/api/assistant/models').set('Authorization', c.auth);
    expect(cloud.body.active).toEqual({ provider: 'anthropic', model: 'some-model' });
  });
});

describe('consent', () => {
  it('only the project owner can allow cloud for a project', async () => {
    const owner = await newUser();
    const member = await newUser();
    const p = (await request(app).post('/api/projects').set('Authorization', owner.auth).send({ name: 'billing' })).body;
    await request(app).post(`/api/projects/${p.id}/members`).set('Authorization', owner.auth).send({ userId: member.id });
    expect((await consent(member, { projectId: p.id })).status).toBe(403);
    expect((await consent(owner, { projectId: p.id })).status).toBe(200);
    const list = (await request(app).get('/api/ai').set('Authorization', owner.auth)).body.projects;
    expect(list.find(x => x.id === p.id).consent).toEqual(['anthropic']);
  });
});

describe('cloud guard', () => {
  function guarded() {
    const sent = [];
    const inner = { id: 'anthropic', cloud: true, chat: async req => { sent.push(req); return 'ok'; }, stream: async () => {}, models: async () => [] };
    return { g: new GuardedProvider(inner), sent };
  }

  it('blocks calls that dont say what they send', async () => {
    const { g, sent } = guarded();
    await expect(g.chat({ model: 'm', messages: [{ role: 'user', content: 'x' }] })).rejects.toBeInstanceOf(CloudBlocked);
    expect(sent).toHaveLength(0);
  });

  it('blocks sensitive snippets even with consent', async () => {
    const u = await newUser();
    await consent(u, {});
    const s = await newSnippet(u, { encryption_mode: 'sensitive', wrapped_key: 'sealed', code: 'Y2lwaGVy' });
    const { g, sent } = guarded();
    await expect(g.chat({ model: 'm', messages: [], sourceIds: [s.id] })).rejects.toThrow(/Sensitive snippet/);
    await expect(g.stream({ model: 'm', messages: [], sourceIds: [s.id] }, () => {})).rejects.toThrow(/Sensitive snippet/);
    expect(sent).toHaveLength(0);
  });

  it.skipIf(!STRIPE)('blocks snippets without consent, redacts secrets when allowed', async () => {
    const u = await newUser();
    const s = await newSnippet(u, { code: `const stripe = new Stripe('${STRIPE}');` });
    const { g, sent } = guarded();
    await expect(g.chat({ model: 'm', messages: [], sourceIds: [s.id] })).rejects.toThrow(/No consent/);

    await consent(u, {});
    await g.chat({ model: 'm', messages: [{ role: 'user', content: `explain: ${STRIPE}` }], sourceIds: [s.id] });
    expect(sent[0].messages[0].content).not.toContain(STRIPE);
  });
});

describe('assistant routes with a cloud provider', () => {
  it('sends nothing until the user allows personal snippets', async () => {
    const calls = cloudFetch();
    const u = await cloudUser();
    const s = await newSnippet(u, { title: 'Retry helper', code: 'retry(fetchThing)' });

    const blocked = await request(app).post(`/api/assistant/explain/${s.id}`).set('Authorization', u.auth).send({});
    expect(blocked.status).toBe(403);
    expect(calls).toHaveLength(0);

    await consent(u, {});
    const ok = await request(app).post(`/api/assistant/explain/${s.id}`).set('Authorization', u.auth).send({});
    expect(ok.body.response).toBe('cloud says hi');
    expect(calls).toHaveLength(1);
    expect(calls[0].headers.get('x-api-key')).toBe(KEY);
    expect(calls[0].body).toContain('retry(fetchThing)');
  });

  it('leaves out snippets from projects without consent', async () => {
    const calls = cloudFetch();
    const u = await cloudUser();
    await consent(u, {});
    const p = (await request(app).post('/api/projects').set('Authorization', u.auth).send({ name: 'secret project' })).body;
    await newSnippet(u, { title: 'Retry helper for payments', code: 'PROJECT_ONLY_MARKER retry payments', project_id: p.id, visibility: 'project' });
    const mine = await newSnippet(u, { title: 'Retry helper', code: 'retry(personalThing)' });
    await settle();

    await request(app).post(`/api/assistant/explain/${mine.id}`).set('Authorization', u.auth).send({}).expect(200);
    expect(calls[0].body).toContain('retry(personalThing)');
    expect(calls[0].body).not.toContain('PROJECT_ONLY_MARKER');
  });

  it('never streams or explains sensitive snippets', async () => {
    const calls = cloudFetch();
    const u = await cloudUser();
    await consent(u, {});
    const s = await newSnippet(u, { encryption_mode: 'sensitive', wrapped_key: 'sealed', code: 'Y2lwaGVy' });
    expect((await request(app).post(`/api/assistant/explain/${s.id}`).set('Authorization', u.auth).send({})).status).toBe(400);
    expect((await request(app).get(`/api/stream/explain/${s.id}?token=${u.token}`)).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('stream says 403 before it starts when there is no consent', async () => {
    const calls = cloudFetch();
    const u = await cloudUser();
    const s = await newSnippet(u);
    const res = await request(app).get(`/api/stream/explain/${s.id}?token=${u.token}`);
    expect(res.status).toBe(403);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(calls).toHaveLength(0);
  });

  it('ask your vault explains when nothing may go to the cloud', async () => {
    const calls = cloudFetch();
    const u = await cloudUser();
    const p = (await request(app).post('/api/projects').set('Authorization', u.auth).send({ name: 'infra' })).body;
    for (const t of ['Retry http calls', 'Retry with jitter']) {
      await newSnippet(u, { title: t, code: `retry backoff http ${t}`, project_id: p.id, visibility: 'project' });
    }
    await settle();
    const res = await request(app).post('/api/rag/ask').set('Authorization', u.auth).send({ question: 'retry http backoff' });
    expect(res.body.answer).toMatch(/none of them may go to anthropic/);
    expect(calls).toHaveLength(0);
  });

  it('suggest title needs personal consent for unsaved code', async () => {
    const calls = cloudFetch();
    const u = await cloudUser();
    const res = await request(app).post('/api/assistant/suggest').set('Authorization', u.auth).send({ code: 'print(1)' });
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
});
