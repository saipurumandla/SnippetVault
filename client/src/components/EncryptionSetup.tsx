import { useState, type FormEvent } from 'react';
import { generateKeyPair, encryptPrivateKey } from '../lib/crypto';
import { api } from '../lib/api';
import styles from './EncryptionSetup.module.css';
import { errorMessage } from '../lib/errors';

export default function EncryptionSetup({ onDone }: { onDone: () => void }) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'generating' | 'done'>('form');

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (passphrase.length < 8) { setError('Passphrase must be at least 8 characters'); return; }
    if (passphrase !== confirm) { setError('Passphrases do not match'); return; }
    setLoading(true);
    setError('');
    try {
      setStep('generating');
      const { publicKey, privateKey } = await generateKeyPair();
      const encryptedPrivKey = await encryptPrivateKey(privateKey, passphrase);
      await api.post('/auth/enc-pubkey', { encPublicKey: publicKey });
      localStorage.setItem('encPublicKey', publicKey);
      localStorage.setItem('encPrivateKeyEnc', JSON.stringify(encryptedPrivKey));
      setStep('done');
      setTimeout(onDone, 800);
    } catch (err) {
      setError(errorMessage(err));
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <form className={styles.dialog} onSubmit={handleGenerate}>
        <div className={styles.icon}>🔑</div>
        <h2 className={styles.title}>Set up encryption</h2>
        <p className={styles.desc}>
          Generates an X25519 keypair in your browser. Your private key is encrypted with your passphrase and stored locally. It never leaves your device.
        </p>

        {step === 'done' && (
          <div className={styles.success}>✓ Keypair generated and saved!</div>
        )}
        {step === 'generating' && (
          <div className={styles.info}>Generating keypair…</div>
        )}
        {step === 'form' && (
          <>
            {error && <p className={styles.error}>{error}</p>}
            <input className="input" type="password" placeholder="Choose a strong passphrase" value={passphrase} onChange={e => setPassphrase(e.target.value)} required autoFocus />
            <input className="input" type="password" placeholder="Confirm passphrase" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            <div className={styles.actions}>
              <button type="submit" className="btn-primary" disabled={loading}>
                Generate keypair
              </button>
            </div>
          </>
        )}

        <div className={styles.secNote}>
          <span className="badge">🔒 Local only</span>
          <span className="badge">🔑 Private key never sent</span>
        </div>
      </form>
    </div>
  );
}
