import express from 'express';
import db from '../db.js';
import auth from '../middleware/authMiddleware.js';
import { shareSchema, validate, type ShareInput } from '../validation.js';
import { logEvent } from '../securityLog.js';
import type { SnippetRow } from '../types.js';

const router = express.Router();

router.get('/recipients/:projectId', auth, (req, res) => {
  const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.projectId, req.user!.id);
  if (!member) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const recipients = db.prepare(`
    SELECT u.id, u.email, u.enc_public_key
    FROM users u
    JOIN project_members pm ON pm.user_id = u.id
    WHERE pm.project_id = ? AND u.id != ? AND u.enc_public_key IS NOT NULL
  `).all(req.params.projectId, req.user!.id);
  res.json(recipients);
});

router.post('/:snippetId', auth, validate(shareSchema), (req, res) => {
  const snippet = db.prepare('SELECT * FROM snippets WHERE id = ? AND author_id = ?').get(req.params.snippetId, req.user!.id) as SnippetRow | undefined;
  if (!snippet) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (snippet.encryption_mode !== 'sensitive') {
    res.status(400).json({ error: 'Only sensitive snippets can be shared this way' });
    return;
  }

  const { recipients, payload, expires_at } = req.body as ShareInput;
  db.prepare(`
    UPDATE snippets SET code = ?, wrapped_key = ?, expires_at = ?, updated_at = ? WHERE id = ?
  `).run(
    payload.ciphertext,
    JSON.stringify({ nonce: payload.nonce, recipients }),
    expires_at || null,
    new Date().toISOString(),
    snippet.id,
  );

  logEvent(req.user!.id, 'share', snippet.id, { recipientCount: recipients.length });
  res.json({ ok: true });
});

export default router;
