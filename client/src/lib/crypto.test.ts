import { describe, it, expect } from 'vitest';
import {
  generateKeyPair, sealForSelf, openSealed, sensitiveScheme, decryptSensitive, SEALED_WRAPPED_KEY,
  encryptPrivateKey, decryptPrivateKey,
} from './crypto';

describe('sealed snippets', () => {
  it('round trips and hides the plaintext', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const sealed = await sealForSelf('db password: hunter2', publicKey);
    expect(sealed).not.toContain('hunter2');
    expect(await openSealed(sealed, publicKey, privateKey)).toBe('db password: hunter2');
  });

  it('another key cannot open it', async () => {
    const mine = await generateKeyPair();
    const other = await generateKeyPair();
    const sealed = await sealForSelf('secret', mine.publicKey);
    await expect(openSealed(sealed, other.publicKey, other.privateKey)).rejects.toThrow();
  });

  it('knows the scheme from wrapped_key', () => {
    expect(sensitiveScheme(SEALED_WRAPPED_KEY)).toBe('sealed');
    expect(sensitiveScheme(JSON.stringify({ nonce: 'abc', recipients: [2] }))).toBe('shared');
    expect(sensitiveScheme(null)).toBe('plain');
    expect(sensitiveScheme('not json')).toBe('plain');
  });

  it('decryptSensitive passes old plain snippets through', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    expect(await decryptSensitive('old plain code', null, publicKey, privateKey)).toBe('old plain code');
    const sealed = await sealForSelf('new code', publicKey);
    expect(await decryptSensitive(sealed, SEALED_WRAPPED_KEY, publicKey, privateKey)).toBe('new code');
  });
});

describe('private key protected by passphrase', () => {
  it('round trips with the right passphrase', async () => {
    const { privateKey } = await generateKeyPair();
    const stored = await encryptPrivateKey(privateKey, 'correct horse');
    expect(JSON.stringify(stored)).not.toContain(privateKey);
    expect(await decryptPrivateKey(stored, 'correct horse')).toBe(privateKey);
  });

  it('wrong passphrase fails', async () => {
    const { privateKey } = await generateKeyPair();
    const stored = await encryptPrivateKey(privateKey, 'correct horse');
    await expect(decryptPrivateKey(stored, 'wrong horse')).rejects.toThrow();
  });
});
