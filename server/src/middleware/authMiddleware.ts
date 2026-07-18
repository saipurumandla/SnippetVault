import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { config } from '../config.js';
import { verifyAccessToken } from '../tokens.js';
import type { AuthUser } from '../types.js';

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, config.jwtSecret) as AuthUser;
}

// access tokens only get these, rest stays web only
function neededScope(method: string, base: string, path: string): string | null {
  if (base === '/api/tokens') return method === 'GET' && path === '/current' ? 'any' : null;
  if (base === '/api/projects') return method === 'GET' && path === '/' ? 'read' : null;
  if (base === '/api/tags') return method === 'GET' ? 'read' : 'write';
  if (base === '/api/snippets') return method === 'GET' || path.endsWith('/copy') ? 'read' : 'write';
  return null;
}

const authMiddleware: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    res.status(401).json({ error: 'No token' });
    return;
  }
  const raw = header.split(' ')[1] ?? '';

  if (raw.startsWith('sv_')) {
    const owner = verifyAccessToken(raw);
    if (!owner) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    const scope = neededScope(req.method, req.baseUrl, req.path);
    if (!scope) {
      res.status(403).json({ error: 'Access tokens cant use this, sign in to the web app' });
      return;
    }
    if (scope !== 'any' && !owner.scopes.includes(scope as never)) {
      res.status(403).json({ error: `Token needs the ${scope} scope` });
      return;
    }
    req.user = { id: owner.userId, email: owner.email };
    req.token = { id: owner.tokenId, name: owner.tokenName, scopes: owner.scopes };
    next();
    return;
  }

  try {
    req.user = verifyToken(raw);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export default authMiddleware;
