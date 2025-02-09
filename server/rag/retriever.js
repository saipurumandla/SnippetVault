const db = require('../db');
const { embed } = require('./embedder');

const TOP_K = 10;
const BM25_WEIGHT = 0.4;
const VEC_WEIGHT = 0.6;
const MIN_BM25_HITS = 1;

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function bm25Search(query, userId, projectId) {
  const ftsQuery = query.trim().split(/\s+/).join(' OR ');
  const params = [ftsQuery, userId, userId];
  let filter = '';
  if (projectId) { filter = ' AND s.project_id = ?'; params.push(projectId); }

  return db.prepare(`
    SELECT rc.id as chunk_id, rc.snippet_id, rc.text, rc.chunk_index, rc.project_id,
           s.title, s.language, s.author_id
    FROM rag_chunks rc
    JOIN snippets s ON s.id = rc.snippet_id
    WHERE s.id IN (
      SELECT rowid FROM snippets_fts WHERE snippets_fts MATCH ?
    )
    AND (s.author_id = ? OR s.visibility = 'shared'
      OR (s.visibility = 'project' AND s.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = ?
      ))
    )
    AND s.encryption_mode = 'standard'
    ${filter}
    LIMIT ${TOP_K}
  `).all(...params);
}

async function vectorSearch(queryEmbedding, userId, projectId) {
  const params = [userId, userId];
  let filter = '';
  if (projectId) { filter = ' AND s.project_id = ?'; params.push(projectId); }

  const rows = db.prepare(`
    SELECT rc.id as chunk_id, rc.snippet_id, rc.text, rc.chunk_index, rc.project_id,
           s.title, s.language, re.embedding
    FROM rag_chunks rc
    JOIN snippets s ON s.id = rc.snippet_id
    JOIN rag_embeddings re ON re.chunk_id = rc.id
    WHERE (s.author_id = ? OR s.visibility = 'shared'
      OR (s.visibility = 'project' AND s.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = ?
      ))
    )
    AND s.encryption_mode = 'standard'
    ${filter}
  `).all(...params);

  return rows
    .map(r => {
      const stored = new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4);
      const score = cosineSimilarity(queryEmbedding, stored);
      return { ...r, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}

async function retrieve(query, userId, projectId) {
  const bm25Results = bm25Search(query, userId, projectId);
  if (bm25Results.length < MIN_BM25_HITS) {
    return { chunks: [], lowConfidence: true };
  }

  const queryEmbedding = await embed(query);
  const vecResults = await vectorSearch(queryEmbedding, userId, projectId);

  const scores = new Map();
  bm25Results.forEach((r, i) => {
    const score = BM25_WEIGHT * (1 - i / TOP_K);
    scores.set(r.chunk_id, (scores.get(r.chunk_id) || 0) + score);
  });
  vecResults.forEach(r => {
    const score = VEC_WEIGHT * r.score;
    scores.set(r.chunk_id, (scores.get(r.chunk_id) || 0) + score);
  });

  const allChunks = [...new Map([...bm25Results, ...vecResults].map(r => [r.chunk_id, r])).values()];
  const ranked = allChunks
    .map(c => ({ ...c, finalScore: scores.get(c.chunk_id) || 0 }))
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 5);

  return { chunks: ranked, lowConfidence: false };
}

module.exports = { retrieve };
