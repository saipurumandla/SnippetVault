import sodium from 'libsodium-wrappers-sumo';

export interface EncryptedKey {
  salt: string;
  nonce: string;
  ciphertext: string;
}

export interface BoxPayload {
  ciphertext: string;
  nonce: string;
}

async function ready(): Promise<void> {
  await sodium.ready;
}

export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  await ready();
  const kp = sodium.crypto_box_keypair();
  return {
    publicKey: sodium.to_base64(kp.publicKey),
    privateKey: sodium.to_base64(kp.privateKey),
  };
}

export async function encryptPrivateKey(privateKeyB64: string, passphrase: string): Promise<EncryptedKey> {
  await ready();
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  const key = sodium.crypto_pwhash(
    32, passphrase, salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT
  );
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(sodium.from_base64(privateKeyB64), nonce, key);
  return {
    salt: sodium.to_base64(salt),
    nonce: sodium.to_base64(nonce),
    ciphertext: sodium.to_base64(ciphertext),
  };
}

export async function decryptPrivateKey(encrypted: EncryptedKey, passphrase: string): Promise<string> {
  await ready();
  const salt = sodium.from_base64(encrypted.salt);
  const key = sodium.crypto_pwhash(
    32, passphrase, salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT
  );
  const nonce = sodium.from_base64(encrypted.nonce);
  const ciphertext = sodium.from_base64(encrypted.ciphertext);
  const privateKey = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
  return sodium.to_base64(privateKey);
}

export async function encryptForRecipient(plaintext: string, recipientPublicKeyB64: string, senderPrivateKeyB64: string): Promise<BoxPayload> {
  await ready();
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const recipientPk = sodium.from_base64(recipientPublicKeyB64);
  const senderSk = sodium.from_base64(senderPrivateKeyB64);
  const cipher = sodium.crypto_box_easy(plaintext, nonce, recipientPk, senderSk);
  return {
    ciphertext: sodium.to_base64(cipher),
    nonce: sodium.to_base64(nonce),
  };
}

export async function decryptFromSender(payload: BoxPayload, senderPublicKeyB64: string, recipientPrivateKeyB64: string): Promise<string> {
  await ready();
  const senderPk = sodium.from_base64(senderPublicKeyB64);
  const myPk = sodium.from_base64(recipientPrivateKeyB64);
  const nonce = sodium.from_base64(payload.nonce);
  const cipher = sodium.from_base64(payload.ciphertext);
  const plain = sodium.crypto_box_open_easy(cipher, nonce, senderPk, myPk);
  return sodium.to_string(plain);
}

export const SEALED_WRAPPED_KEY = JSON.stringify({ scheme: 'sealed', v: 1 });

export type SensitiveScheme = 'sealed' | 'shared' | 'plain';

// 'plain' = saved before encryption worked, not encrypted
export function sensitiveScheme(wrappedKey: string | null): SensitiveScheme {
  if (!wrappedKey) return 'plain';
  try {
    const meta = JSON.parse(wrappedKey) as { scheme?: string; nonce?: string };
    if (meta.scheme === 'sealed') return 'sealed';
    if (meta.nonce) return 'shared';
  } catch {
    return 'plain';
  }
  return 'plain';
}

export async function sealForSelf(plaintext: string, publicKeyB64: string): Promise<string> {
  await ready();
  return sodium.to_base64(sodium.crypto_box_seal(plaintext, sodium.from_base64(publicKeyB64)));
}

export async function openSealed(ciphertextB64: string, publicKeyB64: string, privateKeyB64: string): Promise<string> {
  await ready();
  const plain = sodium.crypto_box_seal_open(
    sodium.from_base64(ciphertextB64),
    sodium.from_base64(publicKeyB64),
    sodium.from_base64(privateKeyB64),
  );
  return sodium.to_string(plain);
}

export async function decryptSensitive(
  code: string, wrappedKey: string | null, publicKeyB64: string, privateKeyB64: string,
): Promise<string> {
  const scheme = sensitiveScheme(wrappedKey);
  if (scheme === 'plain') return code;
  if (scheme === 'sealed') return openSealed(code, publicKeyB64, privateKeyB64);
  const { nonce } = JSON.parse(wrappedKey as string) as { nonce: string };
  return decryptFromSender({ ciphertext: code, nonce }, publicKeyB64, privateKeyB64);
}
