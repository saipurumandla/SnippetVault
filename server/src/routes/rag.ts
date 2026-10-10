import express from 'express';
import auth from '../middleware/authMiddleware.js';
import { retrieve } from '../rag/retriever.js';
import { generateAnswer } from '../rag/answerer.js';
import { allowedSources, assistantFor, CloudBlocked } from '../ai/cloud.js';
import { checkPromptInjection, redactSecrets } from '../rag/guardrails.js';

const router = express.Router();

router.post('/ask', auth, async (req, res) => {
  const { question, projectId } = req.body as { question?: string; projectId?: number | null };
  if (!question || !question.trim()) {
    res.status(400).json({ error: 'question required' });
    return;
  }

  const injection = checkPromptInjection(question);
  if (injection.blocked) {
    res.status(400).json({ error: injection.reason });
    return;
  }

  try {
    const assistant = await assistantFor(req.user!.id, process.env.RAG_MODEL);
    const found = await retrieve(question, req.user!.id, projectId || null);
    const chunks = allowedSources(assistant, found.chunks);
    if (!found.lowConfidence && chunks.length === 0) {
      res.json({
        answer: `Matching snippets were found, but none of them may go to ${assistant.provider.id}. Allow it for those projects, or switch to the local model in Settings.`,
        citations: [],
        lowConfidence: true,
      });
      return;
    }
    if (found.lowConfidence) {
      res.json({
        answer: 'Not enough matching snippets found. Try a more specific question.',
        citations: [],
        lowConfidence: true,
      });
      return;
    }
    const { answer, citations } = await generateAnswer(question, chunks, assistant);
    res.json({ answer: redactSecrets(answer), citations, lowConfidence: false });
  } catch (err) {
    if (err instanceof CloudBlocked) {
      res.status(403).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'RAG query failed' });
  }
});

export default router;
