import { useState, type FormEvent } from 'react';
import { decryptPrivateKey } from '../lib/crypto';
import styles from './PassphrasePrompt.module.css';

interface Props {
  onUnlock: (privateKey: string) => void;
  onCancel: () => void;
}

export default function PassphrasePrompt({ onUnlock, onCancel }: Props) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const encPrivKeyRaw = localStorage.getItem('encPrivateKeyEnc');
      if (!encPrivKeyRaw) throw new Error('No keypair found. Go to Settings → Encryption keys to set one up.');
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
        <div className={styles.icon}>🔒</div>
        <h2 className={styles.title}>Unlock sensitive snippet</h2>
        <p className={styles.desc}>Enter your passphrase to decrypt. Unlock session lasts 15 minutes.</p>
        {error && <p className={styles.error}>{error}</p>}
        <input
          className="input"
          type="password"
          placeholder="Passphrase"
          value={passphrase}
          onChange={e => setPassphrase(e.target.value)}
          autoFocus
          required
        />
        <div className={styles.actions}>
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </form>
    </div>
  );
}
