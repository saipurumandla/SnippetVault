const express = require('express');
const auth = require('../middleware/authMiddleware');
const { health, APPROVED_MODELS } = require('../ai/ollamaClient');

const router = express.Router();

router.get('/models', auth, async (req, res) => {
  const available = await health();
  res.json({ available, models: available ? APPROVED_MODELS : [] });
});

module.exports = router;
