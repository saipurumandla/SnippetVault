import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { longDate } from '../lib/dates';
import { languageLabel } from '../lib/languages';
import { useToast } from '../context/ToastContext';
import Header from '../components/Header';
import ConfirmModal from '../components/ConfirmModal';
import type { Snippet } from '../types';
import styles from './Table.module.css';

export default function ExpiredSnippets() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [confirmPurge, setConfirmPurge] = useState<number | null>(null);
  const { toast } = useToast();

  const load = () => {
    setLoadError('');
    api.get<Snippet[]>('/expired')
      .then(setSnippets)
      .catch(err => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const doPurge = async () => {
    const id = confirmPurge;
    setConfirmPurge(null);
    try {
      await api.del(`/expired/${id}`);
      toast('Snippet deleted for good', 'success');
      load();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <div>
      <Header />
      {confirmPurge !== null && (
        <ConfirmModal
          title="Delete this expired snippet?"
          message="The stored ciphertext is removed from the database. It can't be recovered."
          confirmLabel="Delete for good"
          danger
          onConfirm={doPurge}
          onCancel={() => setConfirmPurge(null)}
        />
      )}
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Expired snippets</h1>
        </div>
        <p className={styles.intro}>
          Expired snippets are hidden from the vault and search. They stay here until you delete them, so you can still check what was shared.
        </p>

        {loading ? (
          <p className={styles.note}>Loading…</p>
        ) : loadError ? (
          <div className={styles.note}>
            <p>Could not load expired snippets: {loadError}</p>
            <button className="btn-ghost" onClick={load}>Try again</button>
          </div>
        ) : snippets.length === 0 ? (
          <p className={styles.note}>Nothing has expired.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Language</th>
                <th>Expired</th>
                <th className={styles.right}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {snippets.map(s => (
                <tr key={s.id}>
                  <td className={styles.strong}>{s.title}</td>
                  <td className={styles.muted}>{languageLabel(s.language)}</td>
                  <td className={styles.muted}>{s.expires_at ? longDate(s.expires_at) : '—'}</td>
                  <td className={styles.right}>
                    <button className="btn-danger" onClick={() => setConfirmPurge(s.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
