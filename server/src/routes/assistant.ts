import express from 'express';
import type { Response } from 'express';
import db from '../db.js';
import auth from '../middleware/authMiddleware.js';
import { ollama, localModel } from '../ai/providers/index.js';
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

async function ask(model: string | undefined, prompt: string, temperature: number) {
  return ollama.chat({ model: await localModel(model), messages: [{ role: 'user', content: prompt }], temperature });
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
    const raw = await ask(model, suggestPrompt(code, language), 0.3);
    const match = raw.match(/\{[\s\S]*?\}/);
    const json = (match ? JSON.parse(match[0]) : {}) as { title?: string; description?: string };
    res.json({ title: json.title || '', description: json.description || '' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/models', auth, async (req, res) => {
  const models = await ollama.models();
  res.json({ available: models.length > 0, models });
});

for (const action of ['explain', 'summarize'] as const) {
  router.post(`/${action}/:snippetId`, auth, async (req, res) => {
    const { model } = req.body as { model?: string };
    const snippet = usableSnippet(Number(req.params.snippetId), req.user!.id, res);
    if (!snippet) return;
    try {
      const { chunks } = await retrieve(snippet.title, req.user!.id, snippet.project_id);
      const prompt = action === 'explain' ? explainPrompt(snippet, chunks) : summarizePrompt(snippet, chunks);
      const raw = await ask(model, prompt, 0.2);
      res.json({ response: redactSecrets(raw), citations: citationsOf(chunks) });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
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
    const raw = await ask(model, refactorPrompt(snippet), 0.3);
    res.json({ response: redactSecrets(raw), draft: true, citations: [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
