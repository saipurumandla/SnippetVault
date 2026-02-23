import express from 'express';
import db from '../db.js';
import auth from '../middleware/authMiddleware.js';
import { health, generate, APPROVED_MODELS } from '../ai/ollamaClient.js';
import { explainPrompt, summarizePrompt, refactorPrompt, suggestPrompt } from '../ai/prompts.js';
import { redactSecrets, containsInjection } from '../ai/safetyFilters.js';
import { retrieve } from '../rag/retriever.js';

const router = express.Router();

function getSnippet(snippetId, userId) {
  const snippet = db.prepare('SELECT * FROM snippets WHERE id = ? AND author_id = ?').get(snippetId, userId);
  if (!snippet) return null;
  if (snippet.encryption_mode === 'sensitive') return { error: 'Cannot use AI on sensitive snippets' };
  return snippet;
}

router.post('/suggest', auth, async (req, res) => {
  const { code, language, model = process.env.OLLAMA_DEFAULT_MODEL || 'qwen3-coder:30b' } = req.body;
  if (!code || !code.trim()) return res.status(400).json({ error: 'code required' });
  try {
    const prompt = suggestPrompt(code, language);
    const raw = await generate({ model, prompt, temperature: 0.3 });
    const match = raw.match(/\{[\s\S]*?\}/);
    const json = match ? JSON.parse(match[0]) : {};
    res.json({ title: json.title || '', description: json.description || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/models', auth, async (req, res) => {
  const available = await health();
  res.json({ available, models: available ? APPROVED_MODELS : [] });
});

router.post('/explain/:snippetId', auth, async (req, res) => {
  const { model = process.env.OLLAMA_DEFAULT_MODEL || 'qwen3-coder:30b' } = req.body;
  const snippet = getSnippet(req.params.snippetId, req.user.id);
  if (!snippet) return res.status(404).json({ error: 'Not found' });
  if (snippet.error) return res.status(400).json({ error: snippet.error });
  try {
    const { chunks } = await retrieve(snippet.title, req.user.id, snippet.project_id);
    const prompt = explainPrompt(snippet, chunks);
    const raw = await generate({ model, prompt, temperature: 0.2 });
    res.json({ response: redactSecrets(raw), citations: chunks.map(c => ({ snippetId: c.snippet_id, title: c.title })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/summarize/:snippetId', auth, async (req, res) => {
  const { model = process.env.OLLAMA_DEFAULT_MODEL || 'qwen3-coder:30b' } = req.body;
  const snippet = getSnippet(req.params.snippetId, req.user.id);
  if (!snippet) return res.status(404).json({ error: 'Not found' });
  if (snippet.error) return res.status(400).json({ error: snippet.error });
  try {
    const { chunks } = await retrieve(snippet.title, req.user.id, snippet.project_id);
    const prompt = summarizePrompt(snippet, chunks);
    const raw = await generate({ model, prompt, temperature: 0.2 });
    res.json({ response: redactSecrets(raw), citations: chunks.map(c => ({ snippetId: c.snippet_id, title: c.title })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/refactor/:snippetId', auth, async (req, res) => {
  const { model = process.env.OLLAMA_DEFAULT_MODEL || 'qwen3-coder:30b' } = req.body;
  const snippet = getSnippet(req.params.snippetId, req.user.id);
  if (!snippet) return res.status(404).json({ error: 'Not found' });
  if (snippet.error) return res.status(400).json({ error: snippet.error });
  if (containsInjection(snippet.code)) return res.status(400).json({ error: 'Snippet content blocked by safety filter' });
  try {
    const prompt = refactorPrompt(snippet);
    const raw = await generate({ model, prompt, temperature: 0.3 });
    res.json({ response: redactSecrets(raw), draft: true, citations: [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;