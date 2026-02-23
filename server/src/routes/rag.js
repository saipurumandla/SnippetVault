import express from 'express';
import auth from '../middleware/authMiddleware.js';
import { retrieve } from '../rag/retriever.js';
import { generateAnswer } from '../rag/answerer.js';
import { checkPromptInjection, redactSecrets } from '../rag/guardrails.js';

const router = express.Router();

router.post('/ask', auth, async (req, res) => {
  const { question, projectId } = req.body;
  if (!question || !question.trim()) return res.status(400).json({ error: 'question required' });

  const injectionCheck = checkPromptInjection(question);
  if (injectionCheck.blocked) {
    return res.status(400).json({ error: injectionCheck.reason });
  }

  try {
    const { chunks, lowConfidence } = await retrieve(question, req.user.id, projectId || null);

    if (lowConfidence) {
      return res.json({
        answer: 'Not enough matching snippets found. Try a more specific question.',
        citations: [],
        lowConfidence: true,
      });
    }

    const { answer, citations } = await generateAnswer(question, chunks);
    const safeAnswer = redactSecrets(answer);
    res.json({ answer: safeAnswer, citations, lowConfidence: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'RAG query failed' });
  }
});

export default router;