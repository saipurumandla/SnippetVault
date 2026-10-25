import db from '../db.js';
import { config } from '../config.js';
import { READABLE, readableParams } from '../access.js';
import { embed } from './embedder.js';
import { chunkText } from './indexer.js';

// MiniLM: copies 0.89+, same topic other code ~0.76
export const DUPLICATE_THRESHOLD = Number(process.env.DUPLICATE_THRESHOLD) || 0.85;

export interface SimilarSnippet {
  id: number;
  title: string;
  language: string;
  similarity: number;
}

const squash = (code: string) => code.replace(/\s+/g, ' ').trim();

export async function findSimilar(userId: number, input: { title: string; description?: string; code: string }, excludeId?: number): Promise<SimilarSnippet[]> {
  const found = new Map<number, SimilarSnippet>();
  const target = squash(input.code);
  if (!target) return [];

  // exact copy work also with EMBEDDINGS=off
  const sameSize = db.prepare(`
    SELECT s.id, s.title, s.language, s.code FROM snippets s
    WHERE ${READABLE} AND length(s.code) BETWEEN ? AND ?
  `).all(...readableParams(userId), Math.floor(input.code.length * 0.7), Math.ceil(input.code.length * 1.3) + 20) as (SimilarSnippet & { code: string })[];
  for (const s of sameSize) {
    if (squash(s.code) === target) found.set(s.id, { id: s.id, title: s.title, language: s.language, similarity: 1 });
  }

  if (config.embeddings) {
    const text = chunkText([input.title, input.description, input.code].filter(Boolean).join('\n'))[0]!;
    const rows = db.prepare(`
      WITH knn AS (SELECT chunk_id, distance FROM rag_vec WHERE embedding MATCH ? AND k = 30)
      SELECT s.id, s.title, s.language, knn.distance
      FROM knn
      JOIN rag_chunks rc ON rc.id = knn.chunk_id AND rc.chunk_index = 0
      JOIN snippets s ON s.id = rc.snippet_id
      WHERE ${READABLE}
      ORDER BY knn.distance
    `).all(Buffer.from(new Float32Array(await embed(text)).buffer), ...readableParams(userId)) as (Omit<SimilarSnippet, 'similarity'> & { distance: number })[];
    for (const r of rows) {
      const similarity = Math.round((1 - r.distance) * 1000) / 1000;
      if (similarity >= DUPLICATE_THRESHOLD && !found.has(r.id)) found.set(r.id, { id: r.id, title: r.title, language: r.language, similarity });
    }
  }

  return [...found.values()].filter(s => s.id !== excludeId).sort((a, b) => b.similarity - a.similarity).slice(0, 3);
}
