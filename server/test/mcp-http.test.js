import { describe, it, expect } from 'vitest';
import { app, request, newUser, newSnippet } from './helpers.js';
import { createToken } from '../src/tokens.ts';

const ACCEPT = 'application/json, text/event-stream';
const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'http-test', version: '1' } } };

function rpc(token, body, headers = {}) {
  const r = request(app).post('/mcp').set('Accept', ACCEPT).set('Content-Type', 'application/json');
  if (token) r.set('Authorization', `Bearer ${token}`);
  for (const [k, v] of Object.entries(headers)) r.set(k, v);
  return r.send(body);
}

describe('mcp over streamable http', () => {
  it('initializes and calls a tool with a token', async () => {
    const u = await newUser();
    await newSnippet(u, { title: 'Parse csv rows', code: 'import csv' });
    const { token } = createToken(u.id, 'http', ['read']);

    const hello = await rpc(token, init);
    expect(hello.status).toBe(200);
    expect(hello.body.result.serverInfo.name).toBe('snippetvault');
    expect(hello.headers['mcp-session-id']).toBeUndefined();

    const list = await rpc(token, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    expect(list.body.result.tools.map(t => t.name)).toEqual(['search_snippets', 'get_snippet', 'list_tags', 'propose_snippet']);

    const tags = await rpc(token, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_tags', arguments: {} } });
    expect(tags.body.result.structuredContent).toEqual({ tags: [] });
  });

  it('needs a valid token', async () => {
    expect((await rpc(null, init)).status).toBe(401);
    const bad = await rpc('sv_nope', init);
    expect(bad.status).toBe(401);
    expect(bad.headers['www-authenticate']).toBe('Bearer');
    const u = await newUser();
    const jwtOnly = await rpc(u.token, init);
    expect(jwtOnly.status).toBe(401);
  });

  it('refuses browser requests and other methods', async () => {
    const u = await newUser();
    const { token } = createToken(u.id, 'http', ['read']);
    expect((await rpc(token, init, { Origin: 'https://evil.example' })).status).toBe(403);
    expect((await request(app).get('/mcp').set('Authorization', `Bearer ${token}`)).status).toBe(405);
    expect((await request(app).delete('/mcp')).status).toBe(405);
  });
});

describe('mcp http drafts', () => {
  it('names the draft after the token when the client name is not known', async () => {
    const { default: db } = await import('../src/db.ts');
    const u = await newUser();
    const { token } = createToken(u.id, 'cursor on desktop', ['propose']);
    const res = await rpc(token, { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'propose_snippet', arguments: { title: 't', code: 'x', language: 'js' } } });
    const draft = db.prepare('SELECT source FROM snippet_drafts WHERE id = ?').get(res.body.result.structuredContent.draft_id);
    expect(draft.source).toBe('cursor on desktop');
  });
});
