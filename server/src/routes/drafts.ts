import express from 'express';
import { z } from 'zod';
import db from '../db.js';
import auth from '../middleware/authMiddleware.js';
import { validate } from '../validation.js';
import { toDraft, type Draft } from '../drafts.js';
import { createSnippet } from '../snippets.js';
import { redactSecrets } from '../ai/safetyFilters.js';

const router = express.Router();

type DraftRow = Parameters<typeof toDraft>[0];

function ownPendingDraft(id: number, userId: number): Draft | null {
  const row = db.prepare("SELECT * FROM snippet_drafts WHERE id = ? AND user_id = ? AND status = 'pending'").get(id, userId) as DraftRow | undefined;
  return row ? toDraft(row) : null;
}

function decide(id: number, status: 'accepted' | 'rejected', snippetId: number | null = null): void {
  db.prepare('UPDATE snippet_drafts SET status = ?, snippet_id = ?, decided_at = ? WHERE id = ?')
    .run(status, snippetId, new Date().toISOString(), id);
}

router.get('/', auth, (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
  const rows = db.prepare('SELECT * FROM snippet_drafts WHERE user_id = ? AND status = ? ORDER BY created_at DESC, id DESC LIMIT 200')
    .all(req.user!.id, status) as DraftRow[];
  res.json(rows.map(r => {
    const d = toDraft(r);
    return { ...d, possible_secret: redactSecrets(d.code) !== d.code };
  }));
});

router.get('/:id', auth, (req, res) => {
  const draft = ownPendingDraft(Number(req.params.id), req.user!.id);
  if (!draft) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(draft);
});

const acceptSchema = z.object({ snippet_id: z.number().int().positive().optional() });

router.post('/:id/accept', auth, validate(acceptSchema), (req, res) => {
  const draft = ownPendingDraft(Number(req.params.id), req.user!.id);
  if (!draft) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const { snippet_id } = req.body as z.infer<typeof acceptSchema>;
  if (snippet_id) {
    const own = db.prepare('SELECT id FROM snippets WHERE id = ? AND author_id = ?').get(snippet_id, req.user!.id);
    if (!own) {
      res.status(404).json({ error: 'Snippet not found' });
      return;
    }
    decide(draft.id, 'accepted', snippet_id);
    res.json({ snippet_id });
    return;
  }
  const snippet = createSnippet(req.user!.id, {
    title: draft.title,
    description: draft.description ?? undefined,
    code: draft.code,
    language: draft.language,
  }, draft.tags);
  decide(draft.id, 'accepted', snippet.id);
  res.status(201).json({ snippet_id: snippet.id });
});

router.post('/:id/reject', auth, (req, res) => {
  const draft = ownPendingDraft(Number(req.params.id), req.user!.id);
  if (!draft) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  decide(draft.id, 'rejected');
  res.status(204).end();
});

export default router;
