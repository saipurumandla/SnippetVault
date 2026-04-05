import express from 'express';
import db from '../db.js';
import auth from '../middleware/authMiddleware.js';
import { snippetSchema, validate, type SnippetInput } from '../validation.js';
import { indexSnippet, removeFromIndex } from '../rag/indexer.js';
import { embed } from '../rag/embedder.js';
import { ftsPrefix } from '../rag/fts.js';
import type { SnippetRow } from '../types.js';

const router = express.Router();

type SnippetWithTags = SnippetRow & { tags: string | null };

function reindex(snippet: SnippetRow): void {
  if (snippet.encryption_mode === 'sensitive') return;
  indexSnippet(snippet, embed).catch((err: Error) =>
    console.error('rag reindex failed for snippet', snippet.id, err.message),
  );
}

function tagsOf(snippetId: number): string[] {
  return (db.prepare('SELECT tag FROM snippet_tags WHERE snippet_id = ?').all(snippetId) as { tag: string }[]).map(r => r.tag);
}

function withTagList(rows: SnippetWithTags[]) {
  return rows.map(s => ({ ...s, tags: s.tags ? s.tags.split(',').filter(Boolean) : [] }));
}

function ownSnippet(id: number, userId: number): SnippetRow | undefined {
  return db.prepare('SELECT * FROM snippets WHERE id = ? AND author_id = ?').get(id, userId) as SnippetRow | undefined;
}

router.get('/', auth, (req, res) => {
  const { language, q, project_id } = req.query as { language?: string; q?: string; project_id?: string };
  const userId = req.user!.id;
  const now = new Date().toISOString();

  if (q && q.trim()) {
    const match = ftsPrefix(q);
    const matchIds = match
      ? (db.prepare('SELECT rowid FROM snippets_fts WHERE snippets_fts MATCH ? ORDER BY rank').all(match) as { rowid: number }[]).map(r => r.rowid)
      : [];
    if (matchIds.length === 0) {
      res.json([]);
      return;
    }
    const placeholders = matchIds.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT s.*, GROUP_CONCAT(st.tag) as tags
      FROM snippets s
      LEFT JOIN snippet_tags st ON st.snippet_id = s.id
      WHERE s.id IN (${placeholders}) AND s.author_id = ?
        AND (s.expires_at IS NULL OR s.expires_at > ?)
      GROUP BY s.id
    `).all(...matchIds, userId, now) as SnippetWithTags[];
    res.json(withTagList(rows));
    return;
  }

  const params: (string | number)[] = [userId, userId, now];
  let where = `WHERE (
    s.author_id = ?
    OR s.visibility = 'shared'
    OR (s.visibility = 'project' AND s.project_id IN (
      SELECT project_id FROM project_members WHERE user_id = ?
    ))
  ) AND (s.expires_at IS NULL OR s.expires_at > ?)`;
  if (language) { where += ' AND s.language = ?'; params.push(language); }
  if (project_id) { where += ' AND s.project_id = ?'; params.push(project_id); }

  const rows = db.prepare(`
    SELECT s.*, GROUP_CONCAT(st.tag) as tags
    FROM snippets s
    LEFT JOIN snippet_tags st ON st.snippet_id = s.id
    ${where}
    GROUP BY s.id
    ORDER BY s.updated_at DESC
  `).all(...params) as SnippetWithTags[];
  res.json(withTagList(rows));
});

router.get('/:id', auth, (req, res) => {
  const snippet = db.prepare('SELECT * FROM snippets WHERE id = ?').get(req.params.id) as SnippetRow | undefined;
  if (!snippet) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const userId = req.user!.id;
  const canRead = snippet.author_id === userId
    || snippet.visibility === 'shared'
    || (snippet.visibility === 'project' && !!snippet.project_id &&
        !!db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(snippet.project_id, userId));
  if (!canRead) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.json({ ...snippet, tags: tagsOf(snippet.id) });
});

router.post('/', auth, validate(snippetSchema), (req, res) => {
  const {
    title, description, code, language, visibility = 'private', project_id,
    encryption_mode = 'standard', wrapped_key, expires_at,
  } = req.body as SnippetInput;
  const now = new Date().toISOString();
  // sensitive code come encrypted, server only store it
  const storedWrappedKey = encryption_mode === 'sensitive' ? (wrapped_key || null) : null;

  const result = db.prepare(`
    INSERT INTO snippets (title, description, code, language, visibility, encryption_mode, wrapped_key, project_id, author_id, expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, description || null, code, language, visibility, encryption_mode, storedWrappedKey,
    project_id || null, req.user!.id, expires_at || null, now, now);

  const snippet = db.prepare('SELECT * FROM snippets WHERE id = ?').get(result.lastInsertRowid) as SnippetRow;
  reindex(snippet);
  res.status(201).json({ ...snippet, tags: [] });
});

router.put('/:id', auth, (req, res) => {
  const snippet = ownSnippet(Number(req.params.id), req.user!.id);
  if (!snippet) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const { title, description, code, language, visibility } = req.body as Partial<SnippetInput>;
  const now = new Date().toISOString();

  if (code && code !== snippet.code && snippet.encryption_mode === 'standard') {
    db.prepare('INSERT INTO snippet_versions (snippet_id, code, changed_at) VALUES (?, ?, ?)').run(snippet.id, snippet.code, now);
  }

  db.prepare(`
    UPDATE snippets SET title = ?, description = ?, code = ?, language = ?, visibility = ?, updated_at = ?
    WHERE id = ?
  `).run(
    title ?? snippet.title,
    description ?? snippet.description,
    code ?? snippet.code,
    language ?? snippet.language,
    visibility ?? snippet.visibility,
    now,
    snippet.id,
  );

  const updated = db.prepare('SELECT * FROM snippets WHERE id = ?').get(snippet.id) as SnippetRow;
  reindex(updated);
  res.json({ ...updated, tags: tagsOf(snippet.id) });
});

router.delete('/:id', auth, (req, res) => {
  const snippet = ownSnippet(Number(req.params.id), req.user!.id);
  if (!snippet) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  removeFromIndex(snippet.id);
  db.prepare('DELETE FROM snippet_tags WHERE snippet_id = ?').run(snippet.id);
  db.prepare('DELETE FROM snippet_versions WHERE snippet_id = ?').run(snippet.id);
  db.prepare('DELETE FROM snippets WHERE id = ?').run(snippet.id);
  res.status(204).end();
});

router.post('/:id/copy', auth, (req, res) => {
  const snippet = ownSnippet(Number(req.params.id), req.user!.id);
  if (!snippet) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  db.prepare('UPDATE snippets SET copy_count = copy_count + 1 WHERE id = ?').run(snippet.id);
  res.json({ ok: true });
});

export default router;
