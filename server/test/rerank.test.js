import { describe, it, expect, vi, afterEach } from 'vitest';
import { newUser, newSnippet } from './helpers.js';
import { retrieve } from '../src/rag/retriever.ts';
import { rerankScores } from '../src/rag/rerank.ts';
import { config } from '../src/config.ts';

const settle = () => new Promise(r => setTimeout(r, 50));
afterEach(() => { config.rerank = true; vi.mocked(rerankScores).mockClear(); });

async function vault() {
  const u = await newUser();
  const a = await newSnippet(u, { title: 'Cache layer', code: 'cache get set ttl cache' });
  const b = await newSnippet(u, { title: 'Cache invalidation on write', code: 'invalidate cache when a row is written' });
  await settle();
  return { u, a, b };
}

describe('reranker', () => {
  it('reorders hybrid results by the cross encoder score', async () => {
    const { u, a, b } = await vault();
    vi.mocked(rerankScores).mockImplementationOnce(async (q, docs) => docs.map(d => (d.includes('invalidation') ? 9 : 1)));
    const { chunks } = await retrieve('cache', u.id);
    expect(chunks.map(c => c.snippet_id).slice(0, 2)).toEqual([b.id, a.id]);
    expect(vi.mocked(rerankScores).mock.calls[0][0]).toBe('cache');
  });

  it('keeps hybrid order when the model fails', async () => {
    const { u } = await vault();
    const before = (await (async () => { config.rerank = false; return retrieve('cache', u.id); })()).chunks.map(c => c.snippet_id);
    config.rerank = true;
    vi.mocked(rerankScores).mockRejectedValueOnce(new Error('download failed'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { chunks } = await retrieve('cache', u.id);
    expect(chunks.map(c => c.snippet_id)).toEqual(before);
    expect(err).toHaveBeenCalled();
  });

  it('is skipped with RERANK=off', async () => {
    const { u } = await vault();
    config.rerank = false;
    await retrieve('cache', u.id);
    expect(rerankScores).not.toHaveBeenCalled();
  });
});
