const express = require('express');
const auth = require('../middleware/authMiddleware');
const { retrieve } = require('../rag/retriever');
const { generateAnswer } = require('../rag/answerer');

const router = express.Router();

router.post('/ask', auth, async (req, res) => {
  const { question, projectId } = req.body;
  if (!question || !question.trim()) return res.status(400).json({ error: 'question required' });

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
    res.json({ answer, citations, lowConfidence: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'RAG query failed' });
  }
});

module.exports = router;
