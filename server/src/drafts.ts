import db from './db.js';

export const MAX_PENDING = 50;

export interface DraftInput {
  title: string;
  description?: string;
  code: string;
  language: string;
  tags?: string[];
}

export interface Draft {
  id: number;
  user_id: number;
  token_id: number | null;
  source: string;
  title: string;
  description: string | null;
  code: string;
  language: string;
  tags: string[];
  status: 'pending' | 'accepted' | 'rejected';
  snippet_id: number | null;
  created_at: string;
  decided_at: string | null;
}

type DraftRow = Omit<Draft, 'tags'> & { tags: string };

export function toDraft(row: DraftRow): Draft {
  return { ...row, tags: JSON.parse(row.tags) as string[] };
}

export function pendingCount(userId: number): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM snippet_drafts WHERE user_id = ? AND status = 'pending'").get(userId) as { n: number }).n;
}

export function createDraft(userId: number, tokenId: number | null, source: string, input: DraftInput): Draft {
  const tags = [...new Set((input.tags ?? []).map(t => t.trim().toLowerCase()).filter(Boolean))];
  const result = db.prepare(`
    INSERT INTO snippet_drafts (user_id, token_id, source, title, description, code, language, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, tokenId, source, input.title.trim(), input.description?.trim() || null, input.code,
    input.language.trim().toLowerCase(), JSON.stringify(tags), new Date().toISOString());
  return toDraft(db.prepare('SELECT * FROM snippet_drafts WHERE id = ?').get(result.lastInsertRowid) as DraftRow);
}
