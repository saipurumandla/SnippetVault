import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';

export function encryptAesGcm(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function decryptAesGcm(ciphertextB64: string, key: Buffer): string {
  const buf = Buffer.from(ciphertextB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}

export function generateProjectKey(): Buffer {
  return crypto.randomBytes(32);
}

export function wrapKey(dataKey: Buffer, projectKey: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, projectKey, iv);
  const wrapped = Buffer.concat([cipher.update(dataKey), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), wrapped]).toString('base64');
}

export function unwrapKey(wrappedB64: string, projectKey: Buffer): Buffer {
  const buf = Buffer.from(wrappedB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, projectKey, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}
