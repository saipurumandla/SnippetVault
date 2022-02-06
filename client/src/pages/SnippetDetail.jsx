import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { api } from '../lib/api';
import styles from './SnippetDetail.module.css';

export default function SnippetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [snippet, setSnippet] = useState(null);
  const [error, setError] = useState('');
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';

  useEffect(() => {
    api.get(`/snippets/${id}`)
      .then(setSnippet)
      .catch(err => setError(err.message));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Delete this snippet?')) return;
    try {
      await api.del(`/snippets/${id}`);
      navigate('/vault');
    } catch (err) {
      setError(err.message);
    }
  };

  if (error) return <div className={styles.page}><p className={styles.error}>{error}</p></div>;
  if (!snippet) return <div className={styles.page}><p className={styles.muted}>Loading…</p></div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate('/vault')}>← Back</button>
        <div className={styles.actions}>
          <button className={styles.editBtn} onClick={() => navigate(`/snippet/${id}/edit`)}>Edit</button>
          <button className={styles.delBtn} onClick={handleDelete}>Delete</button>
        </div>
      </div>
      <h1 className={styles.title}>{snippet.title}</h1>
      {snippet.description && <p className={styles.desc}>{snippet.description}</p>}
      <div className={styles.meta}>
        <span className={styles.lang}>{snippet.language}</span>
        <span className={styles.date}>{new Date(snippet.updated_at).toLocaleDateString()}</span>
      </div>
      <div className={styles.editor}>
        <Editor
          height="400px"
          language={snippet.language}
          value={snippet.code}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13 }}
        />
      </div>
    </div>
  );
}
