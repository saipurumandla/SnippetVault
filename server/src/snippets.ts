import db from './db.js';
import { config } from './config.js';
import { indexSnippet } from './rag/indexer.js';
import { embed } from './rag/embedder.js';
import type { SnippetInput } from './validation.js';
import type { SnippetRow } from './types.js';

export function reindex(snippet: SnippetRow): void {
  if (snippet.encryption_mode === 'sensitive' || !config.embeddings) return;
  indexSnippet(snippet, embed).catch((err: Error) =>
    console.error('rag reindex failed for snippet', snippet.id, err.message),
  );
}

export function createSnippet(userId: number, input: SnippetInput, tags: string[] = []): SnippetRow & { tags: string[] } {
  const {
    title, description, code, language, visibility = 'private', project_id,
    encryption_mode = 'standard', wrapped_key, expires_at,
  } = input;
  const now = new Date().toISOString();
  // sensitive code come encrypted, server only store it
  const storedWrappedKey = encryption_mode === 'sensitive' ? wrapped_key : null;

  const snippet = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO snippets (title, description, code, language, visibility, encryption_mode, wrapped_key, project_id, author_id, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, description || null, code, language, visibility, encryption_mode, storedWrappedKey,
      project_id || null, userId, expires_at || null, now, now);
    const addTag = db.prepare('INSERT OR IGNORE INTO snippet_tags (snippet_id, tag) VALUES (?, ?)');
    for (const t of tags) addTag.run(result.lastInsertRowid, t);
    return db.prepare('SELECT * FROM snippets WHERE id = ?').get(result.lastInsertRowid) as SnippetRow;
  })();

  reindex(snippet);
  return { ...snippet, tags };
}
