import express from 'express';
import { z } from 'zod';
import db from '../db.js';
import auth from '../middleware/authMiddleware.js';
import { validate } from '../validation.js';
import { canStoreSecrets, sealSecret } from '../keystore.js';
import { logEvent } from '../securityLog.js';
import { CLOUD_IDS, chosenProvider, cloudFor, type CloudId } from '../ai/cloud.js';
import { ollama } from '../ai/providers/index.js';

const router = express.Router();
const cloudId = z.enum(['anthropic', 'openai']);

function consentList(where: string, ...params: unknown[]): CloudId[] {
  return (db.prepare(`SELECT provider FROM cloud_consent WHERE ${where} ORDER BY provider`).all(...params) as { provider: CloudId }[]).map(r => r.provider);
}

router.get('/', auth, async (req, res) => {
  const userId = req.user!.id;
  const keys = db.prepare('SELECT provider, key_last4 AS last4, model, updated_at FROM ai_keys WHERE user_id = ? ORDER BY provider').all(userId);
  const projects = (db.prepare('SELECT id, name FROM projects WHERE owner_id = ? ORDER BY name').all(userId) as { id: number; name: string }[])
    .map(p => ({ ...p, consent: consentList('project_id = ?', p.id) }));
  res.json({
    provider: chosenProvider(userId),
    canStoreKeys: canStoreSecrets(),
    keys,
    personalConsent: consentList('project_id IS NULL AND granted_by = ?', userId),
    projects,
    localModels: await ollama.models(),
  });
});

router.put('/provider', auth, validate(z.object({ provider: z.enum(['ollama', 'anthropic', 'openai']) })), (req, res) => {
  const { provider } = req.body as { provider: 'ollama' | CloudId };
  const userId = req.user!.id;
  if (provider !== 'ollama' && !db.prepare('SELECT 1 FROM ai_keys WHERE user_id = ? AND provider = ?').get(userId, provider)) {
    res.status(400).json({ error: `Save a ${provider} API key first` });
    return;
  }
  db.prepare(`INSERT INTO ai_settings (user_id, provider, updated_at) VALUES (?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET provider = excluded.provider, updated_at = excluded.updated_at`).run(userId, provider, new Date().toISOString());
  logEvent(userId, 'ai_provider', null, { provider });
  res.json({ provider });
});

const keySchema = z.object({
  apiKey: z.string().trim().min(10).max(300).optional(),
  model: z.string().trim().min(1).max(100).regex(/^[\w.:/@-]+$/, 'Model id has odd characters'),
});

router.put('/keys/:provider', auth, validate(keySchema), (req, res) => {
  const provider = cloudId.safeParse(req.params.provider);
  if (!provider.success) {
    res.status(404).json({ error: 'Unknown provider' });
    return;
  }
  const { apiKey, model } = req.body as z.infer<typeof keySchema>;
  const userId = req.user!.id;
  const now = new Date().toISOString();
  if (apiKey) {
    if (!canStoreSecrets()) {
      res.status(400).json({ error: 'Set MASTER_KEY in .env before saving API keys' });
      return;
    }
    db.prepare(`INSERT INTO ai_keys (user_id, provider, key_enc, key_last4, model, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (user_id, provider) DO UPDATE SET key_enc = excluded.key_enc, key_last4 = excluded.key_last4, model = excluded.model, updated_at = excluded.updated_at`)
      .run(userId, provider.data, sealSecret(apiKey), apiKey.slice(-4), model, now);
  } else {
    const r = db.prepare('UPDATE ai_keys SET model = ?, updated_at = ? WHERE user_id = ? AND provider = ?').run(model, now, userId, provider.data);
    if (!r.changes) {
      res.status(400).json({ error: 'API key is required' });
      return;
    }
  }
  logEvent(userId, 'ai_key', null, { provider: provider.data, model, newKey: !!apiKey });
  res.json({ provider: provider.data, model });
});

router.delete('/keys/:provider', auth, (req, res) => {
  const userId = req.user!.id;
  const r = db.prepare('DELETE FROM ai_keys WHERE user_id = ? AND provider = ?').run(userId, req.params.provider);
  if (!r.changes) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  db.prepare("UPDATE ai_settings SET provider = 'ollama' WHERE user_id = ? AND provider = ?").run(userId, req.params.provider);
  logEvent(userId, 'ai_key_removed', null, { provider: req.params.provider });
  res.status(204).end();
});

router.get('/models/:provider', auth, async (req, res) => {
  const provider = cloudId.safeParse(req.params.provider);
  if (!provider.success) {
    res.status(404).json({ error: 'Unknown provider' });
    return;
  }
  try {
    res.json(await cloudFor(req.user!.id, provider.data).provider.models());
  } catch (err) {
    res.status(400).json({ error: `Could not list models: ${(err as Error).message}` });
  }
});

const consentSchema = z.object({ provider: cloudId, projectId: z.number().int().positive().nullable(), allow: z.boolean() });

router.put('/consent', auth, validate(consentSchema), (req, res) => {
  const { provider, projectId, allow } = req.body as z.infer<typeof consentSchema>;
  const userId = req.user!.id;
  if (projectId && !db.prepare('SELECT 1 FROM projects WHERE id = ? AND owner_id = ?').get(projectId, userId)) {
    res.status(403).json({ error: 'Only the project owner can allow cloud models' });
    return;
  }
  if (allow) {
    const exists = projectId
      ? db.prepare('SELECT 1 FROM cloud_consent WHERE project_id = ? AND provider = ?').get(projectId, provider)
      : db.prepare('SELECT 1 FROM cloud_consent WHERE project_id IS NULL AND granted_by = ? AND provider = ?').get(userId, provider);
    if (!exists) {
      db.prepare('INSERT INTO cloud_consent (project_id, provider, granted_by, granted_at) VALUES (?, ?, ?, ?)').run(projectId, provider, userId, new Date().toISOString());
    }
  } else if (projectId) {
    db.prepare('DELETE FROM cloud_consent WHERE project_id = ? AND provider = ?').run(projectId, provider);
  } else {
    db.prepare('DELETE FROM cloud_consent WHERE project_id IS NULL AND granted_by = ? AND provider = ?').run(userId, provider);
  }
  logEvent(userId, 'cloud_consent', null, { provider, projectId, allow });
  res.json({ provider, projectId, allow });
});

export { CLOUD_IDS };
export default router;
