import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { registerSchema, validate } from '../validation.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', validate(registerSchema), (req, res) => {
  const { email, password } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = bcrypt.hashSync(password, 12);
  const created_at = new Date().toISOString();
  const result = db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)').run(email, password_hash, created_at);

  const token = jwt.sign({ id: result.lastInsertRowid, email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
  res.status(201).json({ token });
});

router.post('/login', validate(registerSchema), (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
  res.json({ token });
});

router.get('/users', authMiddleware, (req, res) => {
  const users = db.prepare('SELECT id, email, enc_public_key FROM users ORDER BY email').all();
  res.json(users);
});

router.post('/enc-pubkey', authMiddleware, (req, res) => {
  const { encPublicKey } = req.body;
  if (!encPublicKey) return res.status(400).json({ error: 'encPublicKey required' });
  db.prepare('UPDATE users SET enc_public_key = ? WHERE id = ?').run(encPublicKey, req.user.id);
  res.json({ ok: true });
});

export default router;