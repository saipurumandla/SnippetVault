import express from 'express';
import db from '../db.js';
import auth from '../middleware/authMiddleware.js';
import { snippetSchema, validate } from '../validation.js';
import { indexSnippet } from '../rag/indexer.js';
import { embed } from '../rag/embedder.js';

const router = express.Router();

function reindex(snippet) {
  if (snippet.encryption_mode === 'sensitive') return;
  indexSnippet(snippet, embed).catch(err =>
    console.error('rag reindex failed for snippet', snippet.id, err.message)
  );
}

function removeFromIndex(snippetId) {
  db.prepare('DELETE FROM rag_chunks WHERE snippet_id = ?').run(snippetId);
}

function parseTags(raw) {
  return raw ? raw.split(',').filter(Boolean) : [];
}

router.get('/', auth, (req, res) => {
  const { language, q, project_id } = req.query;
  const now = new Date().toISOString();

  if (q && q.trim()) {
    const matchIds = db.prepare(`
      SELECT rowid FROM snippets_fts WHERE snippets_fts MATCH ? ORDER BY rank
    `).all(`${q.trim()}*`).map(r => r.rowid);

    if (matchIds.length === 0) return res.json([]);

    const placeholders = matchIds.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT s.*, GROUP_CONCAT(st.tag) as tags
      FROM snippets s
      LEFT JOIN snippet_tags st ON st.snippet_id = s.id
      WHERE s.id IN (${placeholders}) AND s.author_id = ?
        AND (s.expires_at IS NULL OR s.expires_at > ?)
      GROUP BY s.id
    `).all(...matchIds, req.user.id, now);

    return res.json(rows.map(s => ({ ...s, tags: parseTags(s.tags) })));
  }

  const params = [req.user.id, req.user.id, now];
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
  `).all(...params);

  res.json(rows.map(s => ({ ...s, tags: parseTags(s.tags) })));
});

router.get('/:id', auth, (req, res) => {
  const snippet = db.prepare('SELECT * FROM snippets WHERE id = ?').get(req.params.id);
  if (!snippet) return res.status(404).json({ error: 'Not found' });

  const canRead = snippet.author_id === req.user.id
    || snippet.visibility === 'shared'
    || (snippet.visibility === 'project' && snippet.project_id &&
        db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(snippet.project_id, req.user.id));

  if (!canRead) return res.status(403).json({ error: 'Forbidden' });

  const tags = db.prepare('SELECT tag FROM snippet_tags WHERE snippet_id = ?').all(snippet.id).map(r => r.tag);
  res.json({ ...snippet, tags });
});

router.post('/', auth, validate(snippetSchema), (req, res) => {
  const { title, description, code, language, visibility = 'private', project_id, encryption_mode = 'standard', wrapped_key } = req.body;
  if (!title || !code || !language) return res.status(400).json({ error: 'title, code, and language are required' });

  const now = new Date().toISOString();
  // Standard = plaintext. Sensitive = client-encrypted ciphertext sent from browser.
  const storedWrappedKey = encryption_mode === 'sensitive' ? (wrapped_key || null) : null;

  const result = db.prepare(`
    INSERT INTO snippets (title, description, code, language, visibility, encryption_mode, wrapped_key, project_id, author_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, description || null, code, language, visibility, encryption_mode, storedWrappedKey, project_id || null, req.user.id, now, now);

  const snippet = db.prepare('SELECT * FROM snippets WHERE id = ?').get(result.lastInsertRowid);
  reindex(snippet);
  res.status(201).json({ ...snippet, tags: [] });
});

router.put('/:id', auth, (req, res) => {
  const snippet = db.prepare('SELECT * FROM snippets WHERE id = ? AND author_id = ?').get(req.params.id, req.user.id);
  if (!snippet) return res.status(404).json({ error: 'Not found' });

  const { title, description, code, language, visibility } = req.body;
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
    snippet.id
  );

  const updated = db.prepare('SELECT * FROM snippets WHERE id = ?').get(snippet.id);
  const tags = db.prepare('SELECT tag FROM snippet_tags WHERE snippet_id = ?').all(snippet.id).map(r => r.tag);
  reindex(updated);
  res.json({ ...updated, tags });
});

router.delete('/:id', auth, (req, res) => {
  const snippet = db.prepare('SELECT id FROM snippets WHERE id = ? AND author_id = ?').get(req.params.id, req.user.id);
  if (!snippet) return res.status(404).json({ error: 'Not found' });

  removeFromIndex(snippet.id);
  db.prepare('DELETE FROM snippet_tags WHERE snippet_id = ?').run(snippet.id);
  db.prepare('DELETE FROM snippet_versions WHERE snippet_id = ?').run(snippet.id);
  db.prepare('DELETE FROM snippets WHERE id = ?').run(snippet.id);
  res.status(204).end();
});

router.post('/:id/copy', auth, (req, res) => {
  const snippet = db.prepare('SELECT id FROM snippets WHERE id = ? AND author_id = ?').get(req.params.id, req.user.id);
  if (!snippet) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE snippets SET copy_count = copy_count + 1 WHERE id = ?').run(snippet.id);
  res.json({ ok: true });
});

export default router;