import crypto from 'node:crypto';
import db from './db.js';

export const SCOPES = ['read', 'propose', 'write'] as const;
export type Scope = (typeof SCOPES)[number];

export interface AccessToken {
  id: number;
  user_id: number;
  name: string;
  prefix: string;
  scopes: Scope[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface TokenRow extends Omit<AccessToken, 'scopes'> {
  scopes: string;
}

export interface TokenOwner {
  tokenId: number;
  tokenName: string;
  userId: number;
  email: string;
  scopes: Scope[];
}

const TOKEN_PREFIX = 'sv_';

function hash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toToken(row: TokenRow): AccessToken {
  return { ...row, scopes: row.scopes.split(',').filter(Boolean) as Scope[] };
}

export function createToken(userId: number, name: string, scopes: Scope[]): { token: string; record: AccessToken } {
  const token = TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
  const result = db.prepare(`
    INSERT INTO access_tokens (user_id, name, token_hash, prefix, scopes, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, name, hash(token), token.slice(0, 10), [...new Set(scopes)].join(','), new Date().toISOString());
  const row = db.prepare('SELECT * FROM access_tokens WHERE id = ?').get(result.lastInsertRowid) as TokenRow;
  return { token, record: toToken(row) };
}

export function listTokens(userId: number): AccessToken[] {
  const rows = db.prepare(`
    SELECT id, user_id, name, prefix, scopes, created_at, last_used_at, revoked_at
    FROM access_tokens WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId) as TokenRow[];
  return rows.map(toToken);
}

export function revokeToken(userId: number, id: number): boolean {
  const res = db.prepare('UPDATE access_tokens SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL')
    .run(new Date().toISOString(), id, userId);
  return res.changes > 0;
}

export function verifyAccessToken(token: string): TokenOwner | null {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const row = db.prepare(`
    SELECT t.id, t.name, t.user_id, t.scopes, u.email FROM access_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ? AND t.revoked_at IS NULL
  `).get(hash(token)) as { id: number; name: string; user_id: number; scopes: string; email: string } | undefined;
  if (!row) return null;
  db.prepare('UPDATE access_tokens SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  return { tokenId: row.id, tokenName: row.name, userId: row.user_id, email: row.email, scopes: row.scopes.split(',') as Scope[] };
}

export function isTokenActive(tokenId: number): boolean {
  return !!db.prepare('SELECT 1 FROM access_tokens WHERE id = ? AND revoked_at IS NULL').get(tokenId);
}
