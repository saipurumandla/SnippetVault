const express = require('express');
const db = require('../db');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE snippets SET expired_at = ? WHERE expires_at IS NOT NULL AND expires_at <= ? AND expired_at IS NULL
  `).run(now, now);

  const expired = db.prepare(`
    SELECT s.*, GROUP_CONCAT(st.tag) as tags
    FROM snippets s
    LEFT JOIN snippet_tags st ON st.snippet_id = s.id
    WHERE s.author_id = ? AND s.expires_at IS NOT NULL AND s.expires_at <= ?
    GROUP BY s.id
    ORDER BY s.expires_at DESC
  `).all(req.user.id, now);

  res.json(expired.map(s => ({ ...s, tags: s.tags ? s.tags.split(',') : [] })));
});

router.delete('/:id', auth, (req, res) => {
  const snippet = db.prepare('SELECT id FROM snippets WHERE id = ? AND author_id = ? AND expires_at IS NOT NULL').get(req.params.id, req.user.id);
  if (!snippet) return res.status(404).json({ error: 'Not found' });

  db.prepare('DELETE FROM snippet_tags WHERE snippet_id = ?').run(snippet.id);
  db.prepare('DELETE FROM snippet_versions WHERE snippet_id = ?').run(snippet.id);
  db.prepare('DELETE FROM snippets WHERE id = ?').run(snippet.id);
  res.status(204).end();
});

module.exports = router;
