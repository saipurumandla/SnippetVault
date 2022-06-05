const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function encryptAesGcm(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptAesGcm(ciphertextB64, key) {
  const buf = Buffer.from(ciphertextB64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function generateProjectKey() {
  return crypto.randomBytes(32);
}

function wrapKey(dataKey, projectKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, projectKey, iv);
  const wrapped = Buffer.concat([cipher.update(dataKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, wrapped]).toString('base64');
}

function unwrapKey(wrappedB64, projectKey) {
  const buf = Buffer.from(wrappedB64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const wrapped = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, projectKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(wrapped), decipher.final()]);
}

module.exports = { encryptAesGcm, decryptAesGcm, generateProjectKey, wrapKey, unwrapKey };
