import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(import.meta.dirname, '../../.env'), quiet: true });

export const config = {
  port: Number(process.env.PORT) || 3001,
  dbPath: process.env.DB_PATH || path.join(import.meta.dirname, '../../data/vault.db'),
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  logLevel: process.env.LOG_LEVEL || 'info',
  masterKey: process.env.MASTER_KEY || '',
  embeddings: process.env.EMBEDDINGS !== 'off',
  // eval: no gain once bm25 order was fixed, 35x slower
  rerank: process.env.RERANK === 'on',
};

export function isMain(metaUrl: string): boolean {
  return !!process.argv[1] && path.resolve(process.argv[1]) === new URL(metaUrl).pathname;
}
