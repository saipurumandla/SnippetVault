import db from '../db.js';
import type { SnippetRow } from '../types.js';

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 64;

export type EmbedFn = (text: string) => Promise<number[]>;

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + CHUNK_SIZE));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

function buildIndexText(snippet: SnippetRow): string {
  const parts = [snippet.title];
  if (snippet.description) parts.push(snippet.description);
  parts.push(snippet.code);
  return parts.join('\n');
}

export async function indexSnippet(snippet: SnippetRow, embedFn: EmbedFn): Promise<void> {
  if (snippet.encryption_mode === 'sensitive') return;

  db.prepare('DELETE FROM rag_chunks WHERE snippet_id = ?').run(snippet.id);

  const chunks = chunkText(buildIndexText(snippet));
  const now = new Date().toISOString();
  const insertChunk = db.prepare(`
    INSERT INTO rag_chunks (snippet_id, project_id, chunk_index, text, indexed_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertEmbedding = db.prepare(`
    INSERT OR REPLACE INTO rag_embeddings (chunk_id, embedding, model, dims)
    VALUES (?, ?, ?, ?)
  `);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] as string;
    const result = insertChunk.run(snippet.id, snippet.project_id || null, i, chunk, now);
    const embedding = await embedFn(chunk);
    const embBuf = Buffer.from(new Float32Array(embedding).buffer);
    insertEmbedding.run(result.lastInsertRowid, embBuf, 'xenova/all-MiniLM-L6-v2', embedding.length);
  }
}

export async function indexAllPlaintext(embedFn: EmbedFn): Promise<void> {
  const snippets = db.prepare("SELECT * FROM snippets WHERE encryption_mode = 'standard'").all() as SnippetRow[];
  for (const s of snippets) {
    await indexSnippet(s, embedFn);
  }
}
