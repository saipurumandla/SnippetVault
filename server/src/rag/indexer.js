import db from '../db.js';

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 64;

function chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + CHUNK_SIZE));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

function buildIndexText(snippet) {
  const parts = [snippet.title];
  if (snippet.description) parts.push(snippet.description);
  parts.push(snippet.code);
  return parts.join('\n');
}

async function indexSnippet(snippet, embedFn) {
  if (snippet.encryption_mode === 'sensitive') return;

  db.prepare('DELETE FROM rag_chunks WHERE snippet_id = ?').run(snippet.id);

  const text = buildIndexText(snippet);
  const chunks = chunkText(text);
  const now = new Date().toISOString();

  for (let i = 0; i < chunks.length; i++) {
    const result = db.prepare(`
      INSERT INTO rag_chunks (snippet_id, project_id, chunk_index, text, indexed_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(snippet.id, snippet.project_id || null, i, chunks[i], now);

    const embedding = await embedFn(chunks[i]);
    const embBuf = Buffer.from(new Float32Array(embedding).buffer);

    db.prepare(`
      INSERT OR REPLACE INTO rag_embeddings (chunk_id, embedding, model, dims)
      VALUES (?, ?, ?, ?)
    `).run(result.lastInsertRowid, embBuf, 'xenova/all-MiniLM-L6-v2', embedding.length);
  }
}

async function indexAllPlaintext(embedFn) {
  const snippets = db.prepare("SELECT * FROM snippets WHERE encryption_mode = 'standard'").all();
  for (const s of snippets) {
    await indexSnippet(s, embedFn);
  }
}

export { indexSnippet, indexAllPlaintext, chunkText };