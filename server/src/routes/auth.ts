import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import db from '../db.js';
import { config } from '../config.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { registerSchema, validate, type RegisterInput } from '../validation.js';

const router = express.Router();

function signToken(id: number | bigint, email: string): string {
  const options = { expiresIn: config.jwtExpiresIn } as SignOptions;
  return jwt.sign({ id: Number(id), email }, config.jwtSecret, options);
}

router.post('/register', validate(registerSchema), (req, res) => {
  const { email, password } = req.body as RegisterInput;

  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }
  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
    .run(email, hash, new Date().toISOString());

  res.status(201).json({ token: signToken(result.lastInsertRowid, email) });
});

router.post('/login', validate(registerSchema), (req, res) => {
  const { email, password } = req.body as RegisterInput;

  const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email) as
    { id: number; email: string; password_hash: string } | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  res.json({ token: signToken(user.id, user.email) });
});

router.get('/users', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT id, email, enc_public_key FROM users ORDER BY email').all());
});

router.post('/enc-pubkey', authMiddleware, (req, res) => {
  const { encPublicKey } = req.body as { encPublicKey?: string };
  if (!encPublicKey) {
    res.status(400).json({ error: 'encPublicKey required' });
    return;
  }
  db.prepare('UPDATE users SET enc_public_key = ? WHERE id = ?').run(encPublicKey, req.user!.id);
  res.json({ ok: true });
});

export default router;
