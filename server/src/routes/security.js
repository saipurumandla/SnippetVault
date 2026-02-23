import express from 'express';
import db from '../db.js';
import auth from '../middleware/authMiddleware.js';

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

export default router;