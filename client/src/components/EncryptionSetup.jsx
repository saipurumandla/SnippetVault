import React, { useState } from 'react';
import { generateKeyPair, encryptPrivateKey } from '../lib/crypto';
import { api } from '../lib/api';
import styles from './EncryptionSetup.module.css';

export default function EncryptionSetup({ onDone }) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (passphrase.length < 8) { setError('Passphrase must be at least 8 characters'); return; }
    if (passphrase !== confirm) { setError('Passphrases do not match'); return; }
    setLoading(true);
    setError('');
    try {
      const { publicKey, privateKey } = await generateKeyPair();
      const encryptedPrivKey = await encryptPrivateKey(privateKey, passphrase);
      await api.post('/auth/enc-pubkey', { encPublicKey: publicKey });
      localStorage.setItem('encPublicKey', publicKey);
      localStorage.setItem('encPrivateKeyEnc', JSON.stringify(encryptedPrivKey));
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <form className={styles.dialog} onSubmit={handleGenerate}>
        <h2 className={styles.title}>Set up secure mode</h2>
        <p className={styles.desc}>
          This generates an encryption keypair in your browser. Your private key never leaves your device.
        </p>
        {error && <p className={styles.error}>{error}</p>}
        <input
          className={styles.input}
          type="password"
          placeholder="Choose a passphrase"
          value={passphrase}
          onChange={e => setPassphrase(e.target.value)}
          required
        />
        <input
          className={styles.input}
          type="password"
          placeholder="Confirm passphrase"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
        />
        <button className={styles.btn} type="submit" disabled={loading}>
          {loading ? 'Generating…' : 'Generate keypair'}
        </button>
      </form>
    </div>
  );
}
