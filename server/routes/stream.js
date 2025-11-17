const express = require('express');
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const { generateStream } = require('../ai/ollamaClient');
const { explainPrompt, summarizePrompt, refactorPrompt } = require('../ai/prompts');
const { filterToken, containsInjection } = require('../ai/safetyFilters');
const { retrieve } = require('../rag/retriever');

const router = express.Router();

const ACTION_PROMPTS = {
  explain: (snippet, ctx) => explainPrompt(snippet, ctx),
  summarize: (snippet, ctx) => summarizePrompt(snippet, ctx),
  refactor: (snippet) => refactorPrompt(snippet),
};

router.get('/:action/:snippetId', auth, async (req, res) => {
  const { action, snippetId } = req.params;
  const { model = 'qwen2.5-coder' } = req.query;

  if (!ACTION_PROMPTS[action]) return res.status(400).json({ error: 'Unknown action' });

  const snippet = db.prepare('SELECT * FROM snippets WHERE id = ? AND author_id = ?').get(snippetId, req.user.id);
  if (!snippet) return res.status(404).json({ error: 'Not found' });
  if (snippet.encryption_mode === 'sensitive') return res.status(400).json({ error: 'Cannot use AI on sensitive snippets' });

  if (containsInjection(snippet.code)) {
    return res.status(400).json({ error: 'Snippet content blocked by safety filter' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const { chunks } = await retrieve(snippet.title, req.user.id, snippet.project_id).catch(() => ({ chunks: [] }));
  const prompt = ACTION_PROMPTS[action](snippet, chunks);

  let done = false;

  generateStream({
    model, prompt,
    temperature: action === 'refactor' ? 0.3 : 0.2,
    onToken: (token) => {
      if (!done) {
        const safe = filterToken(token);
        res.write(`data: ${JSON.stringify({ token: safe })}\n\n`);
      }
    },
    onDone: () => {
      if (!done) {
        done = true;
        const citations = chunks.map(c => ({ snippetId: c.snippet_id, title: c.title }));
        res.write(`data: ${JSON.stringify({ done: true, citations })}\n\n`);
        res.end();
      }
    },
    onError: (err) => {
      if (!done) {
        done = true;
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    },
  });

  req.on('close', () => { done = true; });
});

module.exports = router;
