import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import SnippetCard from '../components/SnippetCard';
import Sidebar from '../components/Sidebar';
import styles from './Vault.module.css';

export default function Vault() {
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lang, setLang] = useState('');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const load = async (language, q) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (language) params.set('language', language);
    if (q) params.set('q', q);
    try {
      const qs = params.toString() ? `?${params}` : '';
      const data = await api.get(`/snippets${qs}`);
      setSnippets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(lang, search); }, [lang, search]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this snippet?')) return;
    try {
      await api.del(`/snippets/${id}`);
      setSnippets(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={styles.layout}>
      <Sidebar selectedLang={lang} onLangChange={setLang} />
      <div className={styles.page}>
      <div className={styles.toolbar}>
        <h2 className={styles.heading}>Vault</h2>
        <input
          className={styles.search}
          placeholder="Search snippets…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className={styles.newBtn} onClick={() => navigate('/snippet/new')}>+ New Snippet</button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : snippets.length === 0 ? (
        <p className={styles.muted}>No snippets yet. Create one to get started.</p>
      ) : (
        <div className={styles.grid}>
          {snippets.map(s => (
            <SnippetCard key={s.id} snippet={s} onDelete={handleDelete} />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
