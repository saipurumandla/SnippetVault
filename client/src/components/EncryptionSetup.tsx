import { useState, type FormEvent } from 'react';
import { Check, KeyRound } from 'lucide-react';
import { generateKeyPair, encryptPrivateKey } from '../lib/crypto';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import styles from './Dialog.module.css';

export default function EncryptionSetup({ onDone }: { onDone: () => void }) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'generating' | 'done'>('form');

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (passphrase.length < 8) { setError('Passphrase needs at least 8 characters'); return; }
    if (passphrase !== confirm) { setError('Passphrases do not match'); return; }
    setError('');
    setStep('generating');
    try {
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
    }
  };

  return (
    <div className={styles.overlay}>
      <form className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="keys-title" onSubmit={handleGenerate}>
        <h2 id="keys-title" className={styles.title}>
          <KeyRound size={18} strokeWidth={1.75} />
          Set up encryption
        </h2>
        <p className={styles.text}>
          This makes an X25519 keypair in your browser. The private key is encrypted with your
          passphrase and kept in this browser only. It is never sent to the server.
        </p>

        {step === 'done' && <p className={styles.success}><Check size={16} strokeWidth={1.75} /> Keypair saved.</p>}
        {step === 'generating' && <p className={styles.text}>Making keypair…</p>}
        {step === 'form' && (
          <>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <div>
              <label className="field-label" htmlFor="new-pass">Passphrase<span className="required">*</span></label>
              <input id="new-pass" className="input" type="password" value={passphrase}
                onChange={e => setPassphrase(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="field-label" htmlFor="confirm-pass">Repeat passphrase<span className="required">*</span></label>
              <input id="confirm-pass" className="input" type="password" value={confirm}
                onChange={e => setConfirm(e.target.value)} required />
            </div>
            <div className={styles.actions}>
              <button type="submit" className="btn-primary">Create keypair</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
