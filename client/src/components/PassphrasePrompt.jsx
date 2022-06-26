import React, { useState } from 'react';
import { decryptPrivateKey } from '../lib/crypto';
import styles from './PassphrasePrompt.module.css';

export default function PassphrasePrompt({ onUnlock, onCancel }) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const encPrivKeyRaw = localStorage.getItem('encPrivateKeyEnc');
      if (!encPrivKeyRaw) throw new Error('No encrypted key found. Set up secure mode first.');
      const encPrivKey = JSON.parse(encPrivKeyRaw);
      const privateKey = await decryptPrivateKey(encPrivKey, passphrase);
      onUnlock(privateKey);
    } catch {
      setError('Wrong passphrase or corrupted key');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <form className={styles.dialog} onSubmit={handleSubmit}>
        <h2 className={styles.title}>Unlock secure snippet</h2>
        <p className={styles.desc}>Enter your passphrase to decrypt this snippet.</p>
        {error && <p className={styles.error}>{error}</p>}
        <input
          className={styles.input}
          type="password"
          placeholder="Passphrase"
          value={passphrase}
          onChange={e => setPassphrase(e.target.value)}
          autoFocus
          required
        />
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel}>Cancel</button>
          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </form>
    </div>
  );
}
