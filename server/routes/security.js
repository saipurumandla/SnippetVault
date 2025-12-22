const express = require('express');
const db = require('../db');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/events', auth, (req, res) => {
  const events = db.prepare(`
    SELECT * FROM security_events
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 200
  `).all(req.user.id);
  res.json(events);
});

module.exports = router;
