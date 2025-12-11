import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import Header from '../components/Header';
import styles from './ExpiredSnippets.module.css';

export default function ExpiredSnippets() {
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = () => {
    api.get('/expired').then(setSnippets).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handlePurge = async (id) => {
    if (!confirm('Permanently delete this expired snippet?')) return;
    try {
      await api.del(`/expired/${id}`);
      toast('Snippet purged', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div>
      <Header />
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Expired Snippets</h1>
        </div>
        <div className={styles.notice}>
          <span className="badge badge-amber">⏳ Expiry</span>
          <p>Expired snippets are hidden from normal search and lists. Only you and project admins can see them here. They can be permanently purged or kept for forensic review.</p>
        </div>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : snippets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <p className="empty-state-text">No expired snippets.</p>
          </div>
        ) : (
          <div className={styles.list}>
            {snippets.map(s => (
              <div key={s.id} className={`glass-card ${styles.row}`}>
                <div>
                  <p className={styles.title}>{s.title}</p>
                  <p className={styles.meta}>Expired {new Date(s.expires_at).toLocaleString()} · {s.language}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="badge badge-rose">expired</span>
                  <button className="btn-danger" onClick={() => handlePurge(s.id)}>Purge</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
