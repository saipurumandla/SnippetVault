import { describe, it, expect } from 'vitest';
import { newUser, newSnippet } from './helpers.js';
import { retrieve } from '../src/rag/retriever.ts';
import { config } from '../src/config.ts';

const settle = () => new Promise(r => setTimeout(r, 50));

describe('keyword ranking', () => {
  it('puts the best match first, even when it was saved last', async () => {
    const u = await newUser();
    for (let i = 0; i < 12; i++) await newSnippet(u, { title: `Note ${i}`, code: `todo item ${i} cache` });
    const best = await newSnippet(u, { title: 'Cache invalidation', code: 'invalidate cache key on write, cache invalidation' });
    await settle();
    const saved = config.embeddings;
    config.embeddings = false;
    try {
      const { chunks } = await retrieve('cache invalidation', u.id);
      expect(chunks[0].snippet_id).toBe(best.id);
    } finally {
      config.embeddings = saved;
    }
  });
});
