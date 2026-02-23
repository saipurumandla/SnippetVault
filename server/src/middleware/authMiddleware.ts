import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { config } from '../config.js';
import type { AuthUser } from '../types.js';

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, config.jwtSecret) as AuthUser;
}

const authMiddleware: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    res.status(401).json({ error: 'No token' });
    return;
  }
  try {
    req.user = verifyToken(header.split(' ')[1] ?? '');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export default authMiddleware;
