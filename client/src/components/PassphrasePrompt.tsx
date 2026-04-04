import { useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { decryptPrivateKey, type EncryptedKey } from '../lib/crypto';
import { useEscape } from './useEscape';
import styles from './Dialog.module.css';

interface Props {
  onUnlock: (privateKey: string) => void;
  onCancel: () => void;
}

export default function PassphrasePrompt({ onUnlock, onCancel }: Props) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEscape(onCancel);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const stored = localStorage.getItem('encPrivateKeyEnc');
    if (!stored) {
      setError('No keypair on this browser. Set one up in Settings first.');
      setLoading(false);
      return;
    }
    try {
      onUnlock(await decryptPrivateKey(JSON.parse(stored) as EncryptedKey, passphrase));
    } catch {
      setError('Wrong passphrase, or the stored key is damaged.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <form className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="unlock-title" onSubmit={handleSubmit}>
        <h2 id="unlock-title" className={styles.title}>
          <Lock size={18} strokeWidth={1.75} />
          Unlock sensitive snippet
        </h2>
        <p className={styles.text}>Enter your passphrase. The snippet stays unlocked for 15 minutes.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div>
          <label className="field-label" htmlFor="passphrase">Passphrase<span className="required">*</span></label>
          <input id="passphrase" className="input" type="password" value={passphrase}
            onChange={e => setPassphrase(e.target.value)} autoFocus required />
        </div>
        <div className={styles.actions}>
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Unlocking…' : 'Unlock'}</button>
        </div>
      </form>
    </div>
  );
}
