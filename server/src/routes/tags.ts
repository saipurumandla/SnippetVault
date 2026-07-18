import express from 'express';
import db from '../db.js';
import auth from '../middleware/authMiddleware.js';

const router = express.Router();

function ownSnippet(snippetId: number, userId: number, standardOnly: boolean): { id: number } | undefined {
  const sql = `SELECT id FROM snippets WHERE id = ? AND author_id = ?${standardOnly ? " AND encryption_mode = 'standard'" : ''}`;
  return db.prepare(sql).get(snippetId, userId) as { id: number } | undefined;
}

router.get('/', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT DISTINCT st.tag
    FROM snippet_tags st
    JOIN snippets s ON s.id = st.snippet_id
    WHERE s.author_id = ?${req.token ? " AND s.encryption_mode = 'standard'" : ''}
    ORDER BY st.tag
  `).all(req.user!.id) as { tag: string }[];
  res.json(rows.map(r => r.tag));
});

router.post('/:snippetId', auth, (req, res) => {
  const { tag } = req.body as { tag?: string };
  if (!tag || !tag.trim()) {
    res.status(400).json({ error: 'tag is required' });
    return;
  }
  const snippet = ownSnippet(Number(req.params.snippetId), req.user!.id, !!req.token);
  if (!snippet) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  db.prepare('INSERT OR IGNORE INTO snippet_tags (snippet_id, tag) VALUES (?, ?)').run(snippet.id, tag.trim().toLowerCase());
  res.status(201).json({ ok: true });
});

router.delete('/:snippetId/:tag', auth, (req, res) => {
  const snippet = ownSnippet(Number(req.params.snippetId), req.user!.id, !!req.token);
  if (!snippet) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  db.prepare('DELETE FROM snippet_tags WHERE snippet_id = ? AND tag = ?').run(snippet.id, req.params.tag);
  res.status(204).end();
});

export default router;
