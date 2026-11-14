import db from '../db.js';
import { embed } from './embedder.js';
import { config } from '../config.js';
import { ftsAnyOf } from './fts.js';
import { rerankScores } from './rerank.js';
import { READABLE, readableParams } from '../access.js';

const TOP_K = 10;
const BM25_WEIGHT = 0.4;
const VEC_WEIGHT = 0.6;
const MIN_BM25_HITS = 1;
const RERANK_CANDIDATES = 20;
const FINAL_K = 5;

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

function bm25Search(query: string, userId: number, projectId: number | null): RetrievedChunk[] {
  const ftsQuery = ftsAnyOf(query);
  if (!ftsQuery) return [];
  const params: (string | number)[] = [ftsQuery, ...readableParams(userId)];
  let filter = '';
  if (projectId) { filter = ' AND s.project_id = ?'; params.push(projectId); }

  // no order by here took first rows by id, not best
  return db.prepare(`
    SELECT rc.id as chunk_id, rc.snippet_id, rc.text, rc.chunk_index, rc.project_id,
           s.title, s.language
    FROM snippets_fts
    JOIN snippets s ON s.id = snippets_fts.rowid
    JOIN rag_chunks rc ON rc.snippet_id = s.id
    WHERE snippets_fts MATCH ?
    AND ${READABLE}
    ${filter}
    ORDER BY bm25(snippets_fts), rc.chunk_index
    LIMIT ${TOP_K}
  `).all(...params) as RetrievedChunk[];
}

const KNN_CANDIDATES = 50;

function vectorSearch(queryEmbedding: number[], userId: number, projectId: number | null): RetrievedChunk[] {
  const params: (Buffer | number | string)[] = [Buffer.from(new Float32Array(queryEmbedding).buffer), KNN_CANDIDATES, ...readableParams(userId)];
  let filter = '';
  if (projectId) { filter = ' AND s.project_id = ?'; params.push(projectId); }

  // knn run before access filter, so ask for more
  const rows = db.prepare(`
    WITH knn AS (
      SELECT chunk_id, distance FROM rag_vec WHERE embedding MATCH ? AND k = ?
    )
    SELECT rc.id as chunk_id, rc.snippet_id, rc.text, rc.chunk_index, rc.project_id,
           s.title, s.language, knn.distance
    FROM knn
    JOIN rag_chunks rc ON rc.id = knn.chunk_id
    JOIN snippets s ON s.id = rc.snippet_id
    WHERE ${READABLE}
    ${filter}
    ORDER BY knn.distance
    LIMIT ${TOP_K}
  `).all(...params) as (RetrievedChunk & { distance: number })[];

  return rows.map(({ distance, ...r }) => ({ ...r, score: 1 - distance }));
}

async function rerankIfOn<T extends RetrievedChunk & { finalScore: number }>(query: string, chunks: T[]): Promise<T[]> {
  if (!config.rerank || !config.embeddings || chunks.length < 2) return chunks;
  try {
    const scores = await rerankScores(query, chunks.map(c => `${c.title}\n${c.text}`));
    return chunks.map((c, i) => ({ c, s: scores[i]! })).sort((a, b) => b.s - a.s).map(x => x.c);
  } catch (err) {
    // keep hybrid order when model cant load
    console.error('rerank failed, using hybrid order:', (err as Error).message);
    return chunks;
  }
}

export async function retrieve(query: string, userId: number, projectId: number | null = null): Promise<RetrieveResult> {
  const bm25Results = bm25Search(query, userId, projectId);
  if (bm25Results.length < MIN_BM25_HITS) {
    return { chunks: [], lowConfidence: true };
  }

  const vecResults = config.embeddings ? vectorSearch(await embed(query), userId, projectId) : [];

  const scores = new Map<number, number>();
  bm25Results.forEach((r, i) => {
    scores.set(r.chunk_id, (scores.get(r.chunk_id) || 0) + BM25_WEIGHT * (1 - i / TOP_K));
  });
  vecResults.forEach(r => {
    scores.set(r.chunk_id, (scores.get(r.chunk_id) || 0) + VEC_WEIGHT * (r.score ?? 0));
  });

  const unique = [...new Map([...bm25Results, ...vecResults].map(r => [r.chunk_id, r])).values()];
  const fused = unique
    .map(c => ({ ...c, finalScore: scores.get(c.chunk_id) || 0 }))
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, RERANK_CANDIDATES);

  const ranked = (await rerankIfOn(query, fused)).slice(0, FINAL_K);
  return { chunks: ranked, lowConfidence: false };
}
