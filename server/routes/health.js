const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

router.get('/ready', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});

module.exports = router;
