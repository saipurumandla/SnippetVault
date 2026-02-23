import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { generateStream } from '../ai/ollamaClient.js';
import { explainPrompt, summarizePrompt, refactorPrompt, convertPrompt } from '../ai/prompts.js';
import { filterToken, containsInjection } from '../ai/safetyFilters.js';
import { retrieve } from '../rag/retriever.js';

const router = express.Router();

// EventSource can't send headers — verify JWT from query string instead
function sseAuth(req, res, next) {
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

const ACTION_PROMPTS = {
  explain:  (snippet, ctx, _lang) => explainPrompt(snippet, ctx),
  summarize:(snippet, ctx, _lang) => summarizePrompt(snippet, ctx),
  refactor: (snippet, _ctx, _lang) => refactorPrompt(snippet),
  convert:  (snippet, _ctx, targetLang) => convertPrompt(snippet, targetLang),
};

router.get('/:action/:snippetId', sseAuth, async (req, res) => {
  const { action, snippetId } = req.params;
  const { model = process.env.OLLAMA_DEFAULT_MODEL || 'qwen3-coder:30b', target_lang } = req.query;

  if (!ACTION_PROMPTS[action]) return res.status(400).json({ error: 'Unknown action' });
  if (action === 'convert' && !target_lang) return res.status(400).json({ error: 'target_lang required for convert' });

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
  const prompt = ACTION_PROMPTS[action](snippet, chunks, target_lang);

  let done = false;

  generateStream({
    model, prompt,
    temperature: (action === 'refactor' || action === 'convert') ? 0.3 : 0.2,
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

export default router;