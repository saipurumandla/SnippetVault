const express = require('express');
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const { health, generate, APPROVED_MODELS } = require('../ai/ollamaClient');
const { explainPrompt, summarizePrompt, refactorPrompt } = require('../ai/prompts');
const { retrieve } = require('../rag/retriever');

const router = express.Router();

router.get('/models', auth, async (req, res) => {
  const available = await health();
  res.json({ available, models: available ? APPROVED_MODELS : [] });
});

router.post('/explain/:snippetId', auth, async (req, res) => {
  const { model = 'qwen2.5-coder' } = req.body;
  const snippet = db.prepare('SELECT * FROM snippets WHERE id = ? AND author_id = ?').get(req.params.snippetId, req.user.id);
  if (!snippet) return res.status(404).json({ error: 'Not found' });
  if (snippet.encryption_mode === 'sensitive') return res.status(400).json({ error: 'Cannot use AI on sensitive snippets' });

  try {
    const { chunks } = await retrieve(snippet.title, req.user.id, snippet.project_id);
    const prompt = explainPrompt(snippet, chunks);
    const response = await generate({ model, prompt, temperature: 0.2 });
    res.json({ response, citations: chunks.map(c => ({ snippetId: c.snippet_id, title: c.title })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/summarize/:snippetId', auth, async (req, res) => {
  const { model = 'qwen2.5-coder' } = req.body;
  const snippet = db.prepare('SELECT * FROM snippets WHERE id = ? AND author_id = ?').get(req.params.snippetId, req.user.id);
  if (!snippet) return res.status(404).json({ error: 'Not found' });
  if (snippet.encryption_mode === 'sensitive') return res.status(400).json({ error: 'Cannot use AI on sensitive snippets' });

  try {
    const { chunks } = await retrieve(snippet.title, req.user.id, snippet.project_id);
    const prompt = summarizePrompt(snippet, chunks);
    const response = await generate({ model, prompt, temperature: 0.2 });
    res.json({ response, citations: chunks.map(c => ({ snippetId: c.snippet_id, title: c.title })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/refactor/:snippetId', auth, async (req, res) => {
  const { model = 'qwen2.5-coder' } = req.body;
  const snippet = db.prepare('SELECT * FROM snippets WHERE id = ? AND author_id = ?').get(req.params.snippetId, req.user.id);
  if (!snippet) return res.status(404).json({ error: 'Not found' });
  if (snippet.encryption_mode === 'sensitive') return res.status(400).json({ error: 'Cannot use AI on sensitive snippets' });

  try {
    const prompt = refactorPrompt(snippet);
    const response = await generate({ model, prompt, temperature: 0.3 });
    res.json({ response, draft: true, citations: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
