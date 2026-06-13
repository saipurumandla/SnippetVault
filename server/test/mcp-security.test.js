import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { app, request, newUser, newSnippet } from './helpers.js';
import db from '../src/db.ts';
import { indexSnippet } from '../src/rag/indexer.ts';
import { embed } from '../src/rag/embedder.js';
import { createToken, verifyAccessToken, revokeToken } from '../src/tokens.ts';
import { createVaultServer } from '../src/mcp/server.ts';

const SEALED = JSON.stringify({ scheme: 'sealed', v: 1 });
const TOOLS = {
  search_snippets: { scope: 'read', args: { query: 'anything' } },
  get_snippet: { scope: 'read', args: { id: 1 } },
  list_tags: { scope: 'read', args: {} },
  propose_snippet: { scope: 'propose', args: { title: 't', code: 'x', language: 'js' } },
};

async function session(userId, scopes) {
  const { token, record } = createToken(userId, 'sec test', scopes);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createVaultServer(verifyAccessToken(token)).connect(serverSide);
  const client = new Client({ name: 'sec', version: '1' });
  await client.connect(clientSide);
  return { client, tokenId: record.id };
}

async function indexed(user, fields) {
  const s = await newSnippet(user, fields);
  await indexSnippet(db.prepare('SELECT * FROM snippets WHERE id = ?').get(s.id), embed);
  return s;
}

describe('scope matrix', () => {
  for (const scopes of [['read'], ['propose'], ['read', 'propose']]) {
    it(`token with ${scopes.join('+')} can only use its tools`, async () => {
      const u = await newUser();
      const { client } = await session(u.id, scopes);
      for (const [tool, { scope, args }] of Object.entries(TOOLS)) {
        const res = await client.callTool({ name: tool, arguments: args });
        const blocked = !!res.isError && res.content[0].text.includes('scope');
        expect(blocked, `${tool} with ${scopes}`).toBe(!scopes.includes(scope));
      }
    });
  }
});

describe('sensitive snippets never leave the vault', () => {
  it('not in search, get or tags, even when the title matches exactly', async () => {
    const u = await newUser();
    const secret = await indexed(u, { title: 'prod database password rotation', code: 'Y2lwaGVy', encryption_mode: 'sensitive', wrapped_key: SEALED });
    db.prepare('INSERT INTO snippet_tags (snippet_id, tag) VALUES (?, ?)').run(secret.id, 'prod-secrets');
    // old client plaintext must stay hidden too
    db.prepare('UPDATE snippets SET code = ? WHERE id = ?').run('password=hunter2', secret.id);
    await indexed(u, { title: 'database password policy doc', code: 'min length 16' });
    const { client } = await session(u.id, ['read']);

    const search = await client.callTool({ name: 'search_snippets', arguments: { query: 'prod database password rotation hunter2' } });
    expect(JSON.stringify(search)).not.toContain('hunter2');
    expect(search.structuredContent.results.map(r => r.id)).not.toContain(secret.id);

    const get = await client.callTool({ name: 'get_snippet', arguments: { id: secret.id } });
    expect(get.isError).toBe(true);
    expect(JSON.stringify(get)).not.toContain('rotation');

    const tags = await client.callTool({ name: 'list_tags', arguments: {} });
    expect(JSON.stringify(tags)).not.toContain('prod-secrets');
  });
});

describe('project visibility', () => {
  it('members see project snippets, others do not', async () => {
    const owner = await newUser();
    const member = await newUser();
    const outsider = await newUser();
    const p = (await request(app).post('/api/projects').set('Authorization', owner.auth).send({ name: 'Team' })).body;
    await request(app).post(`/api/projects/${p.id}/members`).set('Authorization', owner.auth).send({ userId: member.id });
    const s = await indexed(owner, { title: 'team deploy script', code: 'deploy deploy', visibility: 'project', project_id: p.id });

    const asMember = (await session(member.id, ['read'])).client;
    expect((await asMember.callTool({ name: 'get_snippet', arguments: { id: s.id } })).isError).toBeFalsy();
    const found = await asMember.callTool({ name: 'search_snippets', arguments: { query: 'team deploy script' } });
    expect(found.structuredContent.results.map(r => r.id)).toContain(s.id);

    const asOutsider = (await session(outsider.id, ['read'])).client;
    expect((await asOutsider.callTool({ name: 'get_snippet', arguments: { id: s.id } })).isError).toBe(true);
    const nothing = await asOutsider.callTool({ name: 'search_snippets', arguments: { query: 'team deploy script' } });
    expect(nothing.structuredContent.results.map(r => r.id)).not.toContain(s.id);
  });
});

describe('revoked tokens', () => {
  it('stop working in an open session, not only on next connect', async () => {
    const u = await newUser();
    const { client, tokenId } = await session(u.id, ['read']);
    expect((await client.callTool({ name: 'list_tags', arguments: {} })).isError).toBeFalsy();
    revokeToken(u.id, tokenId);
    const res = await client.callTool({ name: 'list_tags', arguments: {} });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('revoked');
  });
});

describe('hostile input', () => {
  it('search survives fts syntax and huge limits are refused', async () => {
    const u = await newUser();
    await indexed(u, { title: 'normal snippet', code: 'x' });
    const { client } = await session(u.id, ['read']);
    for (const query of ['"; DROP TABLE snippets; --', 'NEAR(a b)', '***', 'title:secret']) {
      const res = await client.callTool({ name: 'search_snippets', arguments: { query } });
      expect(res.isError, query).toBeFalsy();
    }
    expect((await client.callTool({ name: 'search_snippets', arguments: { query: 'x', limit: 5000 } })).isError).toBe(true);
    expect(db.prepare('SELECT COUNT(*) AS n FROM snippets').get().n).toBeGreaterThan(0);
  });
});
