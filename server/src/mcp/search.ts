import db from '../db.js';
import { retrieve } from '../rag/retriever.js';

export interface SearchHit {
  id: number;
  title: string;
  language: string;
  tags: string[];
  score: number;
  excerpt: string;
}

export function tagsFor(ids: number[]): Map<number, string[]> {
  const map = new Map<number, string[]>(ids.map(id => [id, []]));
  if (!ids.length) return map;
  const rows = db.prepare(`SELECT snippet_id, tag FROM snippet_tags WHERE snippet_id IN (${ids.map(() => '?').join(',')}) ORDER BY tag`)
    .all(...ids) as { snippet_id: number; tag: string }[];
  for (const r of rows) map.get(r.snippet_id)?.push(r.tag);
  return map;
}

export async function searchSnippets(userId: number, query: string, opts: { language?: string; limit?: number } = {}): Promise<SearchHit[]> {
  const { chunks, lowConfidence } = await retrieve(query, userId);
  if (lowConfidence) return [];

  const best = new Map<number, SearchHit>();
  for (const c of chunks) {
    if (opts.language && c.language !== opts.language) continue;
    const score = c.finalScore ?? 0;
    const prev = best.get(c.snippet_id);
    if (!prev || score > prev.score) {
      best.set(c.snippet_id, { id: c.snippet_id, title: c.title, language: c.language, tags: [], score, excerpt: c.text.slice(0, 280) });
    }
  }
  const hits = [...best.values()].sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 8);
  const tags = tagsFor(hits.map(h => h.id));
  return hits.map(h => ({ ...h, score: Math.round(h.score * 1000) / 1000, tags: tags.get(h.id) ?? [] }));
}
