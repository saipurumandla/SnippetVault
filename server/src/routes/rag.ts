import express from 'express';
import auth from '../middleware/authMiddleware.js';
import { retrieve } from '../rag/retriever.js';
import { generateAnswer } from '../rag/answerer.js';
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
    const { chunks, lowConfidence } = await retrieve(question, req.user!.id, projectId || null);
    if (lowConfidence) {
      res.json({
        answer: 'Not enough matching snippets found. Try a more specific question.',
        citations: [],
        lowConfidence: true,
      });
      return;
    }
    const { answer, citations } = await generateAnswer(question, chunks);
    res.json({ answer: redactSecrets(answer), citations, lowConfidence: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'RAG query failed' });
  }
});

export default router;
