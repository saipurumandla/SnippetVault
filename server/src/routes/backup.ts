import express from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import auth from '../middleware/authMiddleware.js';
import { encryptAesGcm, decryptAesGcm } from '../crypto.js';
import type { SnippetRow } from '../types.js';

const router = express.Router();

interface Bundle {
  snippets: SnippetRow[];
  tags: { snippet_id: number; tag: string }[];
  exportedAt: string;
}

function backupKey(passphrase: string): Buffer {
  return crypto.scryptSync(passphrase, 'snippetvault-backup-salt', 32);
}

router.get('/export', auth, (req, res) => {
  const passphrase = req.query.passphrase;
  if (typeof passphrase !== 'string' || !passphrase) {
    res.status(400).json({ error: 'passphrase required' });
    return;
  }
  const snippets = db.prepare('SELECT * FROM snippets WHERE author_id = ? AND encryption_mode = ?').all(req.user!.id, 'standard') as SnippetRow[];
  const tags = db.prepare('SELECT st.* FROM snippet_tags st JOIN snippets s ON s.id = st.snippet_id WHERE s.author_id = ?').all(req.user!.id) as Bundle['tags'];

  const bundle: Bundle = { snippets, tags, exportedAt: new Date().toISOString() };
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="vault-backup.enc"');
  res.send(encryptAesGcm(JSON.stringify(bundle), backupKey(passphrase)));
});

router.post('/restore', auth, express.text({ type: 'text/plain', limit: '50mb' }), (req, res) => {
  const passphrase = req.query.passphrase;
  if (typeof passphrase !== 'string' || !passphrase) {
    res.status(400).json({ error: 'passphrase required' });
    return;
  }

  let bundle: Bundle;
  try {
    bundle = JSON.parse(decryptAesGcm(req.body as string, backupKey(passphrase))) as Bundle;
  } catch {
    res.status(400).json({ error: 'Invalid backup file or wrong passphrase' });
    return;
  }

  const importSnippet = db.prepare(`
    INSERT OR IGNORE INTO snippets (title, description, code, language, visibility, encryption_mode, wrapped_key, project_id, author_id, copy_count, is_favourite, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const s of bundle.snippets) {
      importSnippet.run(s.title, s.description, s.code, s.language, s.visibility, s.encryption_mode, s.wrapped_key, null,
        req.user!.id, s.copy_count, s.is_favourite, s.created_at, s.updated_at);
    }
  })();

  res.json({ imported: bundle.snippets.length });
});

export default router;
