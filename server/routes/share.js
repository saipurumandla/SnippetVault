const express = require('express');
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const { shareSchema, validate } = require('../validation');
const { logEvent } = require('../securityLog');

const router = express.Router();

router.get('/recipients/:projectId', auth, (req, res) => {
  const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.projectId, req.user.id);
  if (!member) return res.status(403).json({ error: 'Forbidden' });

  const recipients = db.prepare(`
    SELECT u.id, u.email, u.enc_public_key
    FROM users u
    JOIN project_members pm ON pm.user_id = u.id
    WHERE pm.project_id = ? AND u.id != ? AND u.enc_public_key IS NOT NULL
  `).all(req.params.projectId, req.user.id);

  res.json(recipients);
});

router.post('/:snippetId', auth, validate(shareSchema), (req, res) => {
  const snippet = db.prepare('SELECT * FROM snippets WHERE id = ? AND author_id = ?').get(req.params.snippetId, req.user.id);
  if (!snippet) return res.status(404).json({ error: 'Not found' });
  if (snippet.encryption_mode !== 'sensitive') return res.status(400).json({ error: 'Only sensitive snippets can be shared this way' });

  const { recipients, payload, expires_at } = req.body;
  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'recipients required' });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE snippets SET code = ?, wrapped_key = ?, expires_at = ?, updated_at = ? WHERE id = ?
  `).run(
    payload.ciphertext,
    JSON.stringify({ nonce: payload.nonce, recipients }),
    expires_at || null,
    now,
    snippet.id
  );

  logEvent(req.user.id, 'share', snippet.id, { recipientCount: recipients.length });
  res.json({ ok: true });
});

module.exports = router;
