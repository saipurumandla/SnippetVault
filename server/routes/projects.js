const express = require('express');
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const { projectSchema, validate } = require('../validation');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const projects = db.prepare(`
    SELECT p.* FROM projects p
    JOIN project_members pm ON pm.project_id = p.id
    WHERE pm.user_id = ?
    ORDER BY p.name
  `).all(req.user.id);
  res.json(projects);
});

router.post('/', auth, validate(projectSchema), (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const now = new Date().toISOString();
  const result = db.prepare('INSERT INTO projects (name, description, owner_id, created_at) VALUES (?, ?, ?, ?)').run(name.trim(), description || null, req.user.id, now);
  db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)').run(result.lastInsertRowid, req.user.id);

  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid));
});

router.post('/:id/members', auth, (req, res) => {
  const { userId } = req.body;
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Not found or not owner' });

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)').run(project.id, userId);
  res.status(201).json({ ok: true });
});

router.get('/:id/members', auth, (req, res) => {
  const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Forbidden' });

  const members = db.prepare(`
    SELECT u.id, u.email FROM users u
    JOIN project_members pm ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `).all(req.params.id);
  res.json(members);
});

module.exports = router;
