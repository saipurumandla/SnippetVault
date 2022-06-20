import sodium from 'libsodium-wrappers';

async function ready() {
  await sodium.ready;
}

export async function generateKeyPair() {
  await ready();
  const kp = sodium.crypto_box_keypair();
  return {
    publicKey: sodium.to_base64(kp.publicKey),
    privateKey: sodium.to_base64(kp.privateKey),
  };
}

export async function encryptPrivateKey(privateKeyB64, passphrase) {
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

export async function decryptPrivateKey(encrypted, passphrase) {
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

export async function encryptForRecipient(plaintext, recipientPublicKeyB64, senderPrivateKeyB64) {
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

export async function decryptFromSender(payload, senderPublicKeyB64, recipientPrivateKeyB64) {
  await ready();
  const senderPk = sodium.from_base64(senderPublicKeyB64);
  const myPk = sodium.from_base64(recipientPrivateKeyB64);
  const nonce = sodium.from_base64(payload.nonce);
  const cipher = sodium.from_base64(payload.ciphertext);
  const plain = sodium.crypto_box_open_easy(cipher, nonce, senderPk, myPk);
  return sodium.to_string(plain);
}
