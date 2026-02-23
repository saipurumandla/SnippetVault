import express from 'express';
import db from '../db.js';
import auth from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', auth, (req, res) => {
  const tags = db.prepare(`
    SELECT DISTINCT st.tag
    FROM snippet_tags st
    JOIN snippets s ON s.id = st.snippet_id
    WHERE s.author_id = ?
    ORDER BY st.tag
  `).all(req.user.id).map(r => r.tag);
  res.json(tags);
});

router.post('/:snippetId', auth, (req, res) => {
  const { tag } = req.body;
  if (!tag || !tag.trim()) return res.status(400).json({ error: 'tag is required' });

  const snippet = db.prepare('SELECT id FROM snippets WHERE id = ? AND author_id = ?').get(req.params.snippetId, req.user.id);
  if (!snippet) return res.status(404).json({ error: 'Not found' });

  db.prepare('INSERT OR IGNORE INTO snippet_tags (snippet_id, tag) VALUES (?, ?)').run(snippet.id, tag.trim().toLowerCase());
  res.status(201).json({ ok: true });
});

router.delete('/:snippetId/:tag', auth, (req, res) => {
  const snippet = db.prepare('SELECT id FROM snippets WHERE id = ? AND author_id = ?').get(req.params.snippetId, req.user.id);
  if (!snippet) return res.status(404).json({ error: 'Not found' });

  db.prepare('DELETE FROM snippet_tags WHERE snippet_id = ? AND tag = ?').run(snippet.id, req.params.tag);
  res.status(204).end();
});

export default router;