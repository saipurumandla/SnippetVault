import db from '../db.js';
import { embed } from './embedder.js';
import { ftsAnyOf } from './fts.js';

const TOP_K = 10;
const BM25_WEIGHT = 0.4;
const VEC_WEIGHT = 0.6;
const MIN_BM25_HITS = 1;

export interface RetrievedChunk {
  chunk_id: number;
  snippet_id: number;
  text: string;
  chunk_index: number;
  project_id: number | null;
  title: string;
  language: string;
  score?: number;
  finalScore?: number;
}

export interface RetrieveResult {
  chunks: RetrievedChunk[];
  lowConfidence: boolean;
}

const ACCESS_FILTER = `(s.author_id = ? OR s.visibility = 'shared'
      OR (s.visibility = 'project' AND s.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = ?
      ))
    )
    AND s.encryption_mode = 'standard'`;

function bm25Search(query: string, userId: number, projectId: number | null): RetrievedChunk[] {
  const ftsQuery = ftsAnyOf(query);
  if (!ftsQuery) return [];
  const params: (string | number)[] = [ftsQuery, userId, userId];
  let filter = '';
  if (projectId) { filter = ' AND s.project_id = ?'; params.push(projectId); }

  return db.prepare(`
    SELECT rc.id as chunk_id, rc.snippet_id, rc.text, rc.chunk_index, rc.project_id,
           s.title, s.language
    FROM rag_chunks rc
    JOIN snippets s ON s.id = rc.snippet_id
    WHERE s.id IN (
      SELECT rowid FROM snippets_fts WHERE snippets_fts MATCH ?
    )
    AND ${ACCESS_FILTER}
    ${filter}
    LIMIT ${TOP_K}
  `).all(...params) as RetrievedChunk[];
}

const KNN_CANDIDATES = 50;

function vectorSearch(queryEmbedding: number[], userId: number, projectId: number | null): RetrievedChunk[] {
  const params: (Buffer | number)[] = [Buffer.from(new Float32Array(queryEmbedding).buffer), KNN_CANDIDATES, userId, userId];
  let filter = '';
  if (projectId) { filter = ' AND s.project_id = ?'; params.push(projectId); }

  // knn first, then access filter, so ask more candidates than TOP_K
  const rows = db.prepare(`
    WITH knn AS (
      SELECT chunk_id, distance FROM rag_vec WHERE embedding MATCH ? AND k = ?
    )
    SELECT rc.id as chunk_id, rc.snippet_id, rc.text, rc.chunk_index, rc.project_id,
           s.title, s.language, knn.distance
    FROM knn
    JOIN rag_chunks rc ON rc.id = knn.chunk_id
    JOIN snippets s ON s.id = rc.snippet_id
    WHERE ${ACCESS_FILTER}
    ${filter}
    ORDER BY knn.distance
    LIMIT ${TOP_K}
  `).all(...params) as (RetrievedChunk & { distance: number })[];

  return rows.map(({ distance, ...r }) => ({ ...r, score: 1 - distance }));
}

export async function retrieve(query: string, userId: number, projectId: number | null = null): Promise<RetrieveResult> {
  const bm25Results = bm25Search(query, userId, projectId);
  if (bm25Results.length < MIN_BM25_HITS) {
    return { chunks: [], lowConfidence: true };
  }

  const vecResults = vectorSearch(await embed(query), userId, projectId);

  const scores = new Map<number, number>();
  bm25Results.forEach((r, i) => {
    scores.set(r.chunk_id, (scores.get(r.chunk_id) || 0) + BM25_WEIGHT * (1 - i / TOP_K));
  });
  vecResults.forEach(r => {
    scores.set(r.chunk_id, (scores.get(r.chunk_id) || 0) + VEC_WEIGHT * (r.score ?? 0));
  });

  const unique = [...new Map([...bm25Results, ...vecResults].map(r => [r.chunk_id, r])).values()];
  const ranked = unique
    .map(c => ({ ...c, finalScore: scores.get(c.chunk_id) || 0 }))
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 5);

  return { chunks: ranked, lowConfidence: false };
}
