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

export function removeFromIndex(snippetId: number): void {
  // vec0 is virtual table, cascade dont reach it
  db.prepare('DELETE FROM rag_vec WHERE chunk_id IN (SELECT id FROM rag_chunks WHERE snippet_id = ?)').run(snippetId);
  db.prepare('DELETE FROM rag_chunks WHERE snippet_id = ?').run(snippetId);
}

export async function indexSnippet(snippet: SnippetRow, embedFn: EmbedFn): Promise<void> {
  if (snippet.encryption_mode === 'sensitive') return;

  const chunks = chunkText(buildIndexText(snippet));
  const vectors = await Promise.all(chunks.map(c => embedFn(c)));
  const now = new Date().toISOString();
  const insertChunk = db.prepare(`
    INSERT INTO rag_chunks (snippet_id, project_id, chunk_index, text, indexed_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertVec = db.prepare('INSERT INTO rag_vec (chunk_id, embedding) VALUES (?, ?)');

  db.transaction(() => {
    removeFromIndex(snippet.id);
    chunks.forEach((chunk, i) => {
      const { lastInsertRowid } = insertChunk.run(snippet.id, snippet.project_id || null, i, chunk, now);
      // sqlite-vec need integer rowid, number bind as real
      insertVec.run(BigInt(lastInsertRowid), Buffer.from(new Float32Array(vectors[i] as number[]).buffer));
    });
  })();
}

export async function indexAllPlaintext(embedFn: EmbedFn): Promise<number> {
  const snippets = db.prepare("SELECT * FROM snippets WHERE encryption_mode = 'standard'").all() as SnippetRow[];
  for (const s of snippets) {
    await indexSnippet(s, embedFn);
  }
  return snippets.length;
}
