import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { encryptForRecipient } from '../lib/crypto';
import { useEscape } from './useEscape';
import dialog from './Dialog.module.css';
import styles from './ShareDialog.module.css';
import { errorMessage } from '../lib/errors';
import type { Snippet, UserSummary } from '../types';

interface Props {
  snippet: Snippet;
  projectId: number | null;
  senderPrivateKey: string | null;
  onClose: (shared: boolean) => void;
}

export default function ShareDialog({ snippet, projectId, senderPrivateKey, onClose }: Props) {
  const [recipients, setRecipients] = useState<UserSummary[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [expiryEnabled, setExpiryEnabled] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    api.get<UserSummary[]>(`/share/recipients/${projectId}`)
      .then(data => setRecipients(data.filter(r => r.enc_public_key)))
      .catch(err => setError(errorMessage(err)));
  }, [projectId]);

  useEscape(() => onClose(false));

  const toggleRecipient = (id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const handleShare = async () => {
    if (selected.length === 0) { setError('Select at least one recipient'); return; }
    if (expiryEnabled && !expiryDate) { setError('Enter an expiry date'); return; }
    if (!senderPrivateKey) { setError('Unlock the snippet first'); return; }
    setLoading(true);
    setError('');
    try {
      const payloads = await Promise.all(
        selected.map(async (recipientId) => {
          const recipient = recipients.find(r => r.id === recipientId);
          if (!recipient?.enc_public_key) throw new Error('Recipient has no public key');
          const encrypted = await encryptForRecipient(snippet.code, recipient.enc_public_key, senderPrivateKey);
          return { recipientId, ...encrypted };
        })
      );

      await api.post(`/share/${snippet.id}`, {
        recipients: selected,
        payload: payloads[0],
        expires_at: expiryEnabled ? new Date(expiryDate).toISOString() : null,
      });
      onClose(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={dialog.overlay}>
      <div className={`${dialog.dialog} ${dialog.wide}`} role="dialog" aria-modal="true" aria-labelledby="share-title">
        <h2 id="share-title" className={dialog.title}>Share “{snippet.title}”</h2>
        {error && <p className={dialog.error} role="alert">{error}</p>}

        <fieldset className={styles.recipients}>
          <legend className="field-label">Recipients</legend>
          {recipients.length === 0 ? (
            <p className={dialog.text}>Nobody in this project has set up encryption yet.</p>
          ) : (
            recipients.map(r => (
              <label key={r.id} className={styles.recipient}>
                <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleRecipient(r.id)} />
                <span>{r.email}</span>
              </label>
            ))
          )}
        </fieldset>

        <label className={styles.recipient}>
          <input type="checkbox" checked={expiryEnabled} onChange={e => setExpiryEnabled(e.target.checked)} />
          <span>Expire the snippet</span>
        </label>
        {expiryEnabled && (
          <input className="input" type="datetime-local" aria-label="Expires at" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
        )}

        <div className={dialog.actions}>
          <button className="btn-ghost" onClick={() => onClose(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleShare} disabled={loading}>{loading ? 'Sharing…' : 'Share'}</button>
        </div>
      </div>
    </div>
  );
}
