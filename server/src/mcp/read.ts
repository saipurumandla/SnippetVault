import db from '../db.js';
import { READABLE, readableParams } from '../access.js';
import { tagsFor } from './search.js';

export interface ReadableSnippet {
  id: number;
  title: string;
  description: string | null;
  language: string;
  tags: string[];
  visibility: string;
  updated_at: string;
  code: string;
}

export function getReadableSnippet(userId: number, id: number): ReadableSnippet | null {
  const row = db.prepare(`
    SELECT s.id, s.title, s.description, s.language, s.visibility, s.updated_at, s.code
    FROM snippets s WHERE s.id = ? AND ${READABLE}
  `).get(id, ...readableParams(userId)) as Omit<ReadableSnippet, 'tags'> | undefined;
  if (!row) return null;
  return { ...row, tags: tagsFor([row.id]).get(row.id) ?? [] };
}

export function listReadableTags(userId: number): { tag: string; count: number }[] {
  return db.prepare(`
    SELECT st.tag AS tag, COUNT(*) AS count
    FROM snippet_tags st JOIN snippets s ON s.id = st.snippet_id
    WHERE ${READABLE}
    GROUP BY st.tag ORDER BY count DESC, st.tag
  `).all(...readableParams(userId)) as { tag: string; count: number }[];
}
