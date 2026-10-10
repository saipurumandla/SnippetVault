import express from 'express';
import type { RequestHandler } from 'express';
import db from '../db.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { allowedSources, assertSources, assistantFor, CloudBlocked, type Assistant, type CloudId } from '../ai/cloud.js';
import { explainPrompt, summarizePrompt, refactorPrompt, convertPrompt } from '../ai/prompts.js';
import { filterToken, containsInjection } from '../ai/safetyFilters.js';
import { retrieve, type RetrievedChunk } from '../rag/retriever.js';
import type { SnippetRow } from '../types.js';

const router = express.Router();

// eventsource cant send headers so token come in query
const sseAuth: RequestHandler = (req, res, next) => {
  const token = req.query.token;
  if (typeof token !== 'string' || !token) {
    res.status(401).json({ error: 'No token' });
    return;
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

type Action = 'explain' | 'summarize' | 'refactor' | 'convert';

const ACTION_PROMPTS: Record<Action, (s: SnippetRow, ctx: RetrievedChunk[], lang: string) => string> = {
  explain: (s, ctx) => explainPrompt(s, ctx),
  summarize: (s, ctx) => summarizePrompt(s, ctx),
  refactor: (s) => refactorPrompt(s),
  convert: (s, _ctx, lang) => convertPrompt(s, lang),
};

function isAction(a: string): a is Action {
  return a in ACTION_PROMPTS;
}

router.get('/:action/:snippetId', sseAuth, async (req, res) => {
  const action = String(req.params.action);
  const snippetId = Number(req.params.snippetId);
  const requested = typeof req.query.model === 'string' ? req.query.model : undefined;
  const targetLang = typeof req.query.target_lang === 'string' ? req.query.target_lang : '';

  if (!isAction(action)) {
    res.status(400).json({ error: 'Unknown action' });
    return;
  }
  if (action === 'convert' && !targetLang) {
    res.status(400).json({ error: 'target_lang required for convert' });
    return;
  }

  const snippet = db.prepare('SELECT * FROM snippets WHERE id = ? AND author_id = ?').get(snippetId, req.user!.id) as SnippetRow | undefined;
  if (!snippet) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (snippet.encryption_mode === 'sensitive') {
    res.status(400).json({ error: 'Cannot use AI on sensitive snippets' });
    return;
  }
  if (containsInjection(snippet.code)) {
    res.status(400).json({ error: 'Snippet content blocked by safety filter' });
    return;
  }

  let assistant: Assistant;
  try {
    assistant = await assistantFor(req.user!.id, requested);
    // check before sse headers, so client get a normal 403
    if (assistant.provider.cloud) assertSources(assistant.provider.id as CloudId, [snippet.id]);
  } catch (err) {
    res.status(err instanceof CloudBlocked ? 403 : 400).json({ error: (err as Error).message });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const { chunks: found } = await retrieve(snippet.title, req.user!.id, snippet.project_id).catch(() => ({ chunks: [] as RetrievedChunk[] }));
  const chunks = allowedSources(assistant, found);
  const prompt = ACTION_PROMPTS[action](snippet, chunks, targetLang);
  const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const abort = new AbortController();
  res.on('close', () => abort.abort());

  try {
    await assistant.provider.stream({
      model: assistant.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: action === 'refactor' || action === 'convert' ? 0.3 : 0.2,
      signal: abort.signal,
      sourceIds: [snippet.id, ...chunks.map(c => c.snippet_id)],
    }, token => send({ token: filterToken(token) }));
    send({ done: true, citations: chunks.map(c => ({ snippetId: c.snippet_id, title: c.title })) });
  } catch (err) {
    if (!abort.signal.aborted) send({ error: (err as Error).message });
  }
  res.end();
});

export default router;
