import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Pencil, TriangleAlert, X } from 'lucide-react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { languageLabel } from '../lib/languages';
import { longDate, shortDate } from '../lib/dates';
import { useToast } from '../context/ToastContext';
import Header from '../components/Header';
import type { Draft } from '../types';
import styles from './Drafts.module.css';

export default function Drafts() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const load = () => {
    setLoadError('');
    api.get<Draft[]>('/drafts')
      .then(list => {
        setDrafts(list);
        setSelectedId(cur => (list.some(d => d.id === cur) ? cur : list[0]?.id ?? null));
      })
      .catch(err => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const selected = drafts.find(d => d.id === selectedId) ?? null;

  const accept = async (d: Draft) => {
    setBusy(true);
    try {
      const { snippet_id } = await api.post<{ snippet_id: number }>(`/drafts/${d.id}/accept`, {});
      toast(`Saved as snippet #${snippet_id}`, 'success');
      window.dispatchEvent(new Event('drafts-changed'));
      load();
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };

  const reject = async (d: Draft) => {
    setBusy(true);
    try {
      await api.post(`/drafts/${d.id}/reject`, {});
      toast('Draft rejected', 'success');
      window.dispatchEvent(new Event('drafts-changed'));
      load();
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };

  return (
    <div className={styles.shell}>
      <Header />
      <div className={styles.titleBar}>
        <h1 className="page-title">Drafts</h1>
        <span className={styles.count}>{!loading && `${drafts.length} waiting`}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.listPane}>
          {loading ? (
            <p className={styles.note}>Loading drafts…</p>
          ) : loadError ? (
            <div className={styles.note}>
              <p>Could not load drafts: {loadError}</p>
              <button className="btn-ghost" onClick={load}>Try again</button>
            </div>
          ) : drafts.length === 0 ? (
            <p className={styles.note}>
              Nothing to review. Agents with a token that has the <code>propose</code> scope can suggest snippets, they show up here.
            </p>
          ) : (
            <ul className={styles.list} role="listbox" aria-label="Drafts">
              {drafts.map(d => (
                <li key={d.id} role="option" aria-selected={d.id === selectedId}
                  className={`${styles.row} ${d.id === selectedId ? styles.selected : ''}`} onClick={() => setSelectedId(d.id)}>
                  <span className={styles.rowTitle}>
                    {d.possible_secret && <TriangleAlert size={14} strokeWidth={1.75} className={styles.warnIcon} aria-label="May contain a secret" />}
                    {d.title}
                  </span>
                  <span className={styles.muted}>{d.source}</span>
                  <span className={styles.muted}>{languageLabel(d.language)}</span>
                  <time className={styles.date} dateTime={d.created_at}>{shortDate(d.created_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.previewPane}>
          {selected && (
            <section className={styles.preview} aria-label="Draft preview">
              <div className={styles.head}>
                <h2 className={styles.title}>{selected.title}</h2>
                <div className={styles.actions}>
                  <button className="btn-primary" onClick={() => accept(selected)} disabled={busy}>
                    <Check size={16} strokeWidth={1.75} />
                    Accept
                  </button>
                  <button className="btn-ghost" onClick={() => navigate(`/snippet/new?draft=${selected.id}`)} disabled={busy}>
                    <Pencil size={16} strokeWidth={1.75} />
                    Edit, then accept
                  </button>
                  <button className="btn-danger" onClick={() => reject(selected)} disabled={busy}>
                    <X size={16} strokeWidth={1.75} />
                    Reject
                  </button>
                </div>
              </div>
              <p className={styles.meta}>
                From {selected.source} · {languageLabel(selected.language)} · received {longDate(selected.created_at)}
              </p>
              {selected.possible_secret && (
                <p className={styles.warning} role="alert">
                  <TriangleAlert size={16} strokeWidth={1.75} />
                  This code looks like it has a secret in it. Accept saves it as plain text. Use Edit, then accept and pick Sensitive instead.
                </p>
              )}
              {selected.description && <p>{selected.description}</p>}
              {selected.tags.length > 0 && (
                <div className={styles.tags}>{selected.tags.map(t => <span key={t} className="badge">{t}</span>)}</div>
              )}
              <pre className={styles.code}><code>{selected.code}</code></pre>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
