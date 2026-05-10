import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { newUser, newSnippet } from './helpers.js';
import db from '../src/db.ts';
import { indexSnippet } from '../src/rag/indexer.ts';
import { embed } from '../src/rag/embedder.js';
import { createToken, verifyAccessToken } from '../src/tokens.ts';
import { createVaultServer } from '../src/mcp/server.ts';

async function connect(userId, scopes) {
  const { token } = createToken(userId, 'test agent', scopes);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createVaultServer(verifyAccessToken(token)).connect(serverSide);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientSide);
  return client;
}

async function indexed(user, fields) {
  const s = await newSnippet(user, fields);
  await indexSnippet(db.prepare('SELECT * FROM snippets WHERE id = ?').get(s.id), embed);
  return s;
}

describe('mcp search_snippets', () => {
  it('lists the tool with its schemas', async () => {
    const u = await newUser();
    const client = await connect(u.id, ['read']);
    const { tools } = await client.listTools();
    const search = tools.find(t => t.name === 'search_snippets');
    expect(search.inputSchema.required).toEqual(['query']);
    expect(search.annotations.readOnlyHint).toBe(true);
  });

  it('finds snippets the user can read', async () => {
    const u = await newUser();
    const csv = await indexed(u, { title: 'Parse csv rows', code: 'import csv\nrows = csv.reader(open(path))', language: 'python' });
    await indexed(u, { title: 'Debounce input', code: 'clearTimeout(t)', language: 'javascript' });
    await newSnippet(u, { title: 'tag me', code: 'x' });
    db.prepare('INSERT INTO snippet_tags (snippet_id, tag) VALUES (?, ?)').run(csv.id, 'parsing');

    const client = await connect(u.id, ['read']);
    const res = await client.callTool({ name: 'search_snippets', arguments: { query: 'parse csv rows' } });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent.results[0]).toMatchObject({ id: csv.id, title: 'Parse csv rows', language: 'python', tags: ['parsing'] });
    expect(res.content[0].text).toContain(`#${csv.id} Parse csv rows`);

    const onlyJs = await client.callTool({ name: 'search_snippets', arguments: { query: 'parse csv rows', language: 'javascript' } });
    expect(onlyJs.structuredContent.results.find(r => r.id === csv.id)).toBeUndefined();
  });

  it('needs the read scope', async () => {
    const u = await newUser();
    const client = await connect(u.id, ['propose']);
    const res = await client.callTool({ name: 'search_snippets', arguments: { query: 'anything' } });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('"read" scope');
  });

  it('says so when nothing matches', async () => {
    const u = await newUser();
    const client = await connect(u.id, ['read']);
    const res = await client.callTool({ name: 'search_snippets', arguments: { query: 'kubernetes ingress' } });
    expect(res.structuredContent.results).toEqual([]);
    expect(res.content[0].text).toBe('No matching snippets.');
  });
});

describe('mcp get_snippet and list_tags', () => {
  const SEALED = JSON.stringify({ scheme: 'sealed', v: 1 });

  it('returns full code for a readable snippet', async () => {
    const u = await newUser();
    const s = await newSnippet(u, { title: 'Chunk list', code: 'def batches(items, n):\n    ...', language: 'python', description: 'split work' });
    db.prepare('INSERT INTO snippet_tags (snippet_id, tag) VALUES (?, ?)').run(s.id, 'etl');
    const client = await connect(u.id, ['read']);
    const res = await client.callTool({ name: 'get_snippet', arguments: { id: s.id } });
    expect(res.structuredContent).toMatchObject({ id: s.id, title: 'Chunk list', language: 'python', tags: ['etl'], code: 'def batches(items, n):\n    ...' });
    expect(res.content[0].text).toContain('```python');
  });

  it('hides sensitive, expired and other people private snippets the same way', async () => {
    const u = await newUser();
    const other = await newUser();
    const secret = await newSnippet(u, { title: 'secret', code: 'Y2lwaGVy', encryption_mode: 'sensitive', wrapped_key: SEALED });
    const expired = await newSnippet(u, { title: 'old', code: 'x', expires_at: '2020-01-01T00:00:00Z' });
    const foreign = await newSnippet(other, { title: 'not yours', code: 'x' });
    const shared = await newSnippet(other, { title: 'shared one', code: 'x', visibility: 'shared' });
    const client = await connect(u.id, ['read']);

    for (const id of [secret.id, expired.id, foreign.id, 999999]) {
      const res = await client.callTool({ name: 'get_snippet', arguments: { id } });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toBe(`No snippet #${id}.`);
    }
    const ok = await client.callTool({ name: 'get_snippet', arguments: { id: shared.id } });
    expect(ok.structuredContent.title).toBe('shared one');
  });

  it('counts tags only on snippets the agent may read', async () => {
    const u = await newUser();
    const a = await newSnippet(u, { title: 'a', code: 'x' });
    const b = await newSnippet(u, { title: 'b', code: 'x' });
    const secret = await newSnippet(u, { title: 's', code: 'Y2lwaGVy', encryption_mode: 'sensitive', wrapped_key: SEALED });
    for (const [id, tag] of [[a.id, 'http'], [b.id, 'http'], [b.id, 'retry'], [secret.id, 'prod-db']]) {
      db.prepare('INSERT INTO snippet_tags (snippet_id, tag) VALUES (?, ?)').run(id, tag);
    }
    const client = await connect(u.id, ['read']);
    const res = await client.callTool({ name: 'list_tags', arguments: {} });
    expect(res.structuredContent.tags).toEqual([{ tag: 'http', count: 2 }, { tag: 'retry', count: 1 }]);
  });

  it('rag never retrieves expired snippets', async () => {
    const { retrieve } = await import('../src/rag/retriever.ts');
    const u = await newUser();
    const s = await indexed(u, { title: 'Expired parser', code: 'parser parser', expires_at: '2020-01-01T00:00:00Z' });
    const { chunks } = await retrieve('parser', u.id);
    expect(chunks.find(c => c.snippet_id === s.id)).toBeUndefined();
  });
});

describe('mcp propose_snippet', () => {
  const proposal = { title: 'Sleep helper', code: 'export const sleep = (ms) => new Promise(r => setTimeout(r, ms));', language: 'TypeScript', tags: ['Async', 'async', ' util '] };

  it('writes to the drafts queue, never to snippets', async () => {
    const u = await newUser();
    const before = db.prepare('SELECT COUNT(*) AS n FROM snippets WHERE author_id = ?').get(u.id).n;
    const client = await connect(u.id, ['read', 'propose']);
    const res = await client.callTool({ name: 'propose_snippet', arguments: proposal });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent.status).toBe('pending');

    const draft = db.prepare('SELECT * FROM snippet_drafts WHERE id = ?').get(res.structuredContent.draft_id);
    expect(draft).toMatchObject({ user_id: u.id, source: 'test-client', title: 'Sleep helper', language: 'typescript', status: 'pending' });
    expect(JSON.parse(draft.tags)).toEqual(['async', 'util']);
    expect(db.prepare('SELECT COUNT(*) AS n FROM snippets WHERE author_id = ?').get(u.id).n).toBe(before);
  });

  it('needs the propose scope', async () => {
    const u = await newUser();
    const client = await connect(u.id, ['read']);
    const res = await client.callTool({ name: 'propose_snippet', arguments: proposal });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('"propose" scope');
  });

  it('stops when too many drafts are waiting', async () => {
    const u = await newUser();
    const insert = db.prepare("INSERT INTO snippet_drafts (user_id, source, title, code, language, created_at) VALUES (?, 'x', 't', 'c', 'js', 'now')");
    for (let i = 0; i < 50; i++) insert.run(u.id);
    const client = await connect(u.id, ['propose']);
    const res = await client.callTool({ name: 'propose_snippet', arguments: proposal });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('50 drafts');
  });

  it('rejects oversized input before it reaches the queue', async () => {
    const u = await newUser();
    const client = await connect(u.id, ['propose']);
    const res = await client.callTool({ name: 'propose_snippet', arguments: { ...proposal, tags: Array(11).fill('x') } });
    expect(res.isError).toBe(true);
    expect(db.prepare('SELECT COUNT(*) AS n FROM snippet_drafts WHERE user_id = ?').get(u.id).n).toBe(0);
  });
});
