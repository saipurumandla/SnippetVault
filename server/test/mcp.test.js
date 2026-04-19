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
