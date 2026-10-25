import { describe, it, expect } from 'vitest';
import { app, request, newUser, newSnippet } from './helpers.js';
import { config } from '../src/config.ts';

const settle = () => new Promise(r => setTimeout(r, 50));
const similar = (u, body) => request(app).post('/api/snippets/similar').set('Authorization', u.auth).send(body);
const retry = 'export async function retry(fn, tries = 3) {\n  for (let i = 0; i < tries; i++) {\n    try { return await fn(); } catch (e) { if (i === tries - 1) throw e; }\n  }\n}';

describe('near duplicate check', () => {
  it('finds a copy even with other spacing', async () => {
    const u = await newUser();
    const s = await newSnippet(u, { title: 'Retry helper', code: retry });
    await settle();
    const res = await similar(u, { title: 'my retry', code: retry.replace(/\n\s*/g, ' ') });
    expect(res.body[0]).toMatchObject({ id: s.id, title: 'Retry helper', similarity: 1 });
  });

  it('finds close matches by embedding', async () => {
    const u = await newUser();
    const s = await newSnippet(u, { title: 'Retry helper with backoff', code: retry });
    await settle();
    const res = await similar(u, { title: 'Retry helper with backoff', code: retry.replace('tries', 'times').replace('tries', 'times').replace('tries', 'times') });
    expect(res.body.map(x => x.id)).toContain(s.id);
  });

  it('ignores different code and snippets you cant read', async () => {
    const u = await newUser();
    const other = await newUser();
    await newSnippet(other, { title: 'Retry helper', code: retry });
    await newSnippet(u, { title: 'Parse csv', code: 'import csv\nrows = list(csv.DictReader(open("a.csv")))' });
    await settle();
    expect((await similar(u, { title: 'Retry helper', code: retry })).body).toEqual([]);
  });

  it('never compares against sensitive snippets', async () => {
    const u = await newUser();
    await newSnippet(u, { title: 'Prod env', code: 'Y2lwaGVy', encryption_mode: 'sensitive', wrapped_key: 'sealed' });
    expect((await similar(u, { title: 'x', code: 'Y2lwaGVy' })).body).toEqual([]);
  });

  it('exact match still works with EMBEDDINGS=off', async () => {
    const u = await newUser();
    const s = await newSnippet(u, { title: 'Ping', code: 'SELECT 1 AS ping;' });
    config.embeddings = false;
    try {
      expect((await similar(u, { title: 'y', code: 'SELECT 1 AS ping;' })).body.map(x => x.id)).toEqual([s.id]);
    } finally {
      config.embeddings = true;
    }
  });

  it('needs code', async () => {
    const u = await newUser();
    expect((await similar(u, { title: 'x' })).status).toBe(400);
  });
});
