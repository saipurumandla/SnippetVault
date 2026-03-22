import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { encryptForRecipient } from '../lib/crypto';
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
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <h2 className={styles.title}>Share "{snippet.title}"</h2>
        {error && <p className={styles.error}>{error}</p>}

        <p className={styles.label}>Recipients (must have secure mode enabled)</p>
        {recipients.length === 0 ? (
          <p className={styles.muted}>No eligible recipients in this project.</p>
        ) : (
          <div className={styles.recipientList}>
            {recipients.map(r => (
              <label key={r.id} className={styles.recipient}>
                <input
                  type="checkbox"
                  checked={selected.includes(r.id)}
                  onChange={() => toggleRecipient(r.id)}
                />
                <span>{r.email}</span>
              </label>
            ))}
          </div>
        )}

        <label className={styles.expiryToggle}>
          <input type="checkbox" checked={expiryEnabled} onChange={e => setExpiryEnabled(e.target.checked)} />
          <span>Set expiry</span>
        </label>
        {expiryEnabled && (
          <input
            className={styles.dateInput}
            type="datetime-local"
            value={expiryDate}
            onChange={e => setExpiryDate(e.target.value)}
          />
        )}

        <div className={styles.actions}>
          <button className={styles.cancel} onClick={() => onClose(false)}>Cancel</button>
          <button className={styles.btn} onClick={handleShare} disabled={loading}>
            {loading ? 'Sharing…' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}
