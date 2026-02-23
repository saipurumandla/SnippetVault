import crypto from 'node:crypto';
import db from './db.js';
import { config } from './config.js';
import { encryptAesGcm, decryptAesGcm } from './crypto.js';

// no MASTER_KEY means a new key every start, old project keys cant be read
const MASTER_KEY = config.masterKey
  ? Buffer.from(config.masterKey, 'hex')
  : crypto.randomBytes(32);

export function getOrCreateProjectKey(projectId: number): Buffer {
  const project = db.prepare('SELECT enc_key FROM projects WHERE id = ?').get(projectId) as { enc_key: string | null } | undefined;
  if (!project) throw new Error('Project not found');

  if (project.enc_key) {
    return Buffer.from(decryptAesGcm(project.enc_key, MASTER_KEY), 'base64');
  }

  const projectKey = crypto.randomBytes(32);
  const encryptedKey = encryptAesGcm(projectKey.toString('base64'), MASTER_KEY);
  db.prepare('UPDATE projects SET enc_key = ? WHERE id = ?').run(encryptedKey, projectId);
  return projectKey;
}

export function getPersonalKey(userId: number): Buffer {
  return crypto.createHash('sha256').update(`user-${userId}-${MASTER_KEY.toString('hex')}`).digest();
}
