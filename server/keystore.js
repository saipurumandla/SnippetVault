const crypto = require('crypto');
const db = require('./db');
const { encryptAesGcm, decryptAesGcm } = require('./crypto');

const MASTER_KEY = Buffer.from(process.env.MASTER_KEY || crypto.randomBytes(32).toString('hex').slice(0, 64), 'hex');

function getOrCreateProjectKey(projectId) {
  const project = db.prepare('SELECT enc_key FROM projects WHERE id = ?').get(projectId);
  if (!project) throw new Error('Project not found');

  if (project.enc_key) {
    return Buffer.from(decryptAesGcm(project.enc_key, MASTER_KEY), 'base64');
  }

  const projectKey = crypto.randomBytes(32);
  const encryptedKey = encryptAesGcm(projectKey.toString('base64'), MASTER_KEY);
  db.prepare('UPDATE projects SET enc_key = ? WHERE id = ?').run(encryptedKey, projectId);
  return projectKey;
}

function getPersonalKey(userId) {
  const key = crypto.createHash('sha256').update(`user-${userId}-${MASTER_KEY.toString('hex')}`).digest();
  return key;
}

module.exports = { getOrCreateProjectKey, getPersonalKey };
