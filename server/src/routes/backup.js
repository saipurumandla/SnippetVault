import express from 'express';
import crypto from 'crypto';
import db from '../db.js';
import auth from '../middleware/authMiddleware.js';
import { encryptAesGcm, decryptAesGcm } from '../crypto.js';

const router = express.Router();

router.get('/export', auth, (req, res) => {
  const { passphrase } = req.query;
  if (!passphrase) return res.status(400).json({ error: 'passphrase required' });

  const snippets = db.prepare('SELECT * FROM snippets WHERE author_id = ? AND encryption_mode = ?').all(req.user.id, 'standard');
  const tags = db.prepare('SELECT st.* FROM snippet_tags st JOIN snippets s ON s.id = st.snippet_id WHERE s.author_id = ?').all(req.user.id);

  const bundle = JSON.stringify({ snippets, tags, exportedAt: new Date().toISOString() });
  const key = crypto.scryptSync(passphrase, 'snippetvault-backup-salt', 32);
  const encrypted = encryptAesGcm(bundle, key);

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="vault-backup.enc"');
  res.send(encrypted);
});

router.post('/restore', auth, express.text({ type: 'text/plain', limit: '50mb' }), (req, res) => {
  const { passphrase } = req.query;
  if (!passphrase) return res.status(400).json({ error: 'passphrase required' });

  try {
    const key = crypto.scryptSync(passphrase, 'snippetvault-backup-salt', 32);
    const bundle = JSON.parse(decryptAesGcm(req.body, key));

    const importSnippet = db.prepare(`
      INSERT OR IGNORE INTO snippets (title, description, code, language, visibility, encryption_mode, wrapped_key, project_id, author_id, copy_count, is_favourite, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const importTag = db.prepare('INSERT OR IGNORE INTO snippet_tags (snippet_id, tag) VALUES (?, ?)');

    const tx = db.transaction(() => {
      for (const s of bundle.snippets) {
        importSnippet.run(s.title, s.description, s.code, s.language, s.visibility, s.encryption_mode, s.wrapped_key, null, req.user.id, s.copy_count, s.is_favourite, s.created_at, s.updated_at);
      }
    });
    tx();

    res.json({ imported: bundle.snippets.length });
  } catch {
    res.status(400).json({ error: 'Invalid backup file or wrong passphrase' });
  }
});

export default router;