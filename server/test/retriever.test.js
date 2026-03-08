import { describe, it, expect } from 'vitest';
import { app, request, newUser, newSnippet } from './helpers.js';
import db from '../src/db.ts';
import { retrieve } from '../src/rag/retriever.ts';
import { indexSnippet } from '../src/rag/indexer.ts';
import { embed } from '../src/rag/embedder.js';

async function indexed(user, fields) {
  const s = await newSnippet(user, fields);
  await indexSnippet(db.prepare('SELECT * FROM snippets WHERE id = ?').get(s.id), embed);
  return s;
}

describe('retriever on sqlite-vec', () => {
  it('ranks the matching snippet first', async () => {
    const u = await newUser();
    const csv = await indexed(u, { title: 'Parse csv rows', code: 'import csv\nrows = csv.reader(open(path))', language: 'python' });
    await indexed(u, { title: 'Debounce input', code: 'clearTimeout(t); t = setTimeout(fn, 300)' });
    const { chunks, lowConfidence } = await retrieve('parse csv rows', u.id);
    expect(lowConfidence).toBe(false);
    expect(chunks[0].snippet_id).toBe(csv.id);
    expect(chunks[0].finalScore).toBeGreaterThan(0);
  });

  it('never returns other user private or sensitive snippets', async () => {
    const owner = await newUser();
    const other = await newUser();
    await indexed(owner, { title: 'Owner secret parser', code: 'parser parser parser' });
    await indexed(other, { title: 'Other sensitive parser', code: 'parser', encryption_mode: 'sensitive' });
    await indexed(other, { title: 'Other own parser', code: 'parser' });
    const { chunks } = await retrieve('parser', other.id);
    const titles = chunks.map(c => c.title);
    expect(titles).toContain('Other own parser');
    expect(titles).not.toContain('Owner secret parser');
    expect(titles).not.toContain('Other sensitive parser');
  });

  it('delete removes vectors too', async () => {
    const u = await newUser();
    const s = await indexed(u, { title: 'Temporary thing', code: 'temp temp' });
    const before = db.prepare('SELECT COUNT(*) AS n FROM rag_vec').get().n;
    await request(app).delete(`/api/snippets/${s.id}`).set('Authorization', u.auth);
    expect(db.prepare('SELECT COUNT(*) AS n FROM rag_vec').get().n).toBeLessThan(before);
    expect(db.prepare('SELECT COUNT(*) AS n FROM rag_chunks WHERE snippet_id = ?').get(s.id).n).toBe(0);
  });

  it('reindex replaces old chunks, no duplicates', async () => {
    const u = await newUser();
    const s = await indexed(u, { title: 'Reindex me', code: 'a'.repeat(1200) });
    const row = db.prepare('SELECT * FROM snippets WHERE id = ?').get(s.id);
    await indexSnippet(row, embed);
    await indexSnippet(row, embed);
    const chunks = db.prepare('SELECT COUNT(*) AS n FROM rag_chunks WHERE snippet_id = ?').get(s.id).n;
    expect(chunks).toBe(3);
    const vecs = db.prepare('SELECT COUNT(*) AS n FROM rag_vec WHERE chunk_id IN (SELECT id FROM rag_chunks WHERE snippet_id = ?)').get(s.id).n;
    expect(vecs).toBe(3);
  });
});
