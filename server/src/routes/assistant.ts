import express from 'express';
import type { Response } from 'express';
import db from '../db.js';
import auth from '../middleware/authMiddleware.js';
import { ollama } from '../ai/providers/index.js';
import { activeModel, allowedSources, assertPersonalCloud, assistantFor, CloudBlocked, type Assistant } from '../ai/cloud.js';
import { suggestTags } from '../rag/autotag.js';
import { explainPrompt, summarizePrompt, refactorPrompt, suggestPrompt } from '../ai/prompts.js';
import { redactSecrets, containsInjection } from '../ai/safetyFilters.js';
import { retrieve, type RetrievedChunk } from '../rag/retriever.js';
import type { SnippetRow } from '../types.js';

const router = express.Router();

function usableSnippet(snippetId: number, userId: number, res: Response): SnippetRow | null {
  const snippet = db.prepare('SELECT * FROM snippets WHERE id = ? AND author_id = ?').get(snippetId, userId) as SnippetRow | undefined;
  if (!snippet) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  if (snippet.encryption_mode === 'sensitive') {
    res.status(400).json({ error: 'Cannot use AI on sensitive snippets' });
    return null;
  }
  return snippet;
}

function ask(a: Assistant, prompt: string, temperature: number, sourceIds: number[]) {
  return a.provider.chat({ model: a.model, messages: [{ role: 'user', content: prompt }], temperature, sourceIds });
}

function fail(res: Response, err: unknown) {
  res.status(err instanceof CloudBlocked ? 403 : 500).json({ error: (err as Error).message });
}

function citationsOf(chunks: RetrievedChunk[]) {
  return chunks.map(c => ({ snippetId: c.snippet_id, title: c.title }));
}

router.post('/suggest', auth, async (req, res) => {
  const { code, language, model } = req.body as { code?: string; language?: string; model?: string };
  if (!code || !code.trim()) {
    res.status(400).json({ error: 'code required' });
    return;
  }
  try {
    const a = await assistantFor(req.user!.id, model);
    assertPersonalCloud(a, req.user!.id);
    const raw = await ask(a, suggestPrompt(code, language), 0.3, []);
    const match = raw.match(/\{[\s\S]*?\}/);
    const json = (match ? JSON.parse(match[0]) : {}) as { title?: string; description?: string };
    res.json({ title: json.title || '', description: json.description || '' });
  } catch (err) {
    fail(res, err);
  }
});

router.post('/tags', auth, async (req, res) => {
  const { title = '', description, code, language, tags = [], model } = req.body as { title?: string; description?: string; code?: string; language?: string; tags?: string[]; model?: string };
  if (!code || !code.trim() || code.length > 200_000) {
    res.status(400).json({ error: 'code required' });
    return;
  }
  try {
    const a = await assistantFor(req.user!.id, model);
    assertPersonalCloud(a, req.user!.id);
    res.json(await suggestTags(req.user!.id, { title, description, code, language, tags: Array.isArray(tags) ? tags.map(String) : [] }, a));
  } catch (err) {
    fail(res, err);
  }
});

router.get('/models', auth, async (req, res) => {
  const models = await ollama.models();
  const active = activeModel(req.user!.id);
  const available = active.provider === 'ollama' ? models.includes(active.model) : !!active.model;
  res.json({ available, models, active });
});

for (const action of ['explain', 'summarize'] as const) {
  router.post(`/${action}/:snippetId`, auth, async (req, res) => {
    const { model } = req.body as { model?: string };
    const snippet = usableSnippet(Number(req.params.snippetId), req.user!.id, res);
    if (!snippet) return;
    try {
      const a = await assistantFor(req.user!.id, model);
      const chunks = allowedSources(a, (await retrieve(snippet.title, req.user!.id, snippet.project_id)).chunks);
      const prompt = action === 'explain' ? explainPrompt(snippet, chunks) : summarizePrompt(snippet, chunks);
      const raw = await ask(a, prompt, 0.2, [snippet.id, ...chunks.map(c => c.snippet_id)]);
      res.json({ response: redactSecrets(raw), citations: citationsOf(chunks) });
    } catch (err) {
      fail(res, err);
    }
  });
}

router.post('/refactor/:snippetId', auth, async (req, res) => {
  const { model } = req.body as { model?: string };
  const snippet = usableSnippet(Number(req.params.snippetId), req.user!.id, res);
  if (!snippet) return;
  if (containsInjection(snippet.code)) {
    res.status(400).json({ error: 'Snippet content blocked by safety filter' });
    return;
  }
  try {
    const raw = await ask(await assistantFor(req.user!.id, model), refactorPrompt(snippet), 0.3, [snippet.id]);
    res.json({ response: redactSecrets(raw), draft: true, citations: [] });
  } catch (err) {
    fail(res, err);
  }
});

export default router;
