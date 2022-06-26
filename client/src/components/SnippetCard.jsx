import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import styles from './SnippetCard.module.css';

export default function SnippetCard({ snippet, onDelete }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(snippet.code);
    api.post(`/snippets/${snippet.id}/copy`, {}).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.card} onClick={() => navigate(`/snippet/${snippet.id}`)}>
      <div className={styles.header}>
        <span className={styles.title}>
          {snippet.encryption_mode === 'sensitive' && <span className={styles.lock}>🔒 </span>}
          {snippet.title}
        </span>
        <span className={styles.lang}>{snippet.language}</span>
      </div>
      {snippet.description && (
        <p className={styles.desc}>{snippet.description}</p>
      )}
      <pre className={styles.preview}>{snippet.code.slice(0, 120)}{snippet.code.length > 120 ? '…' : ''}</pre>
      {snippet.tags && snippet.tags.length > 0 && (
        <div className={styles.tags}>
          {snippet.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
        </div>
      )}
      <div className={styles.footer} onClick={e => e.stopPropagation()}>
        <span className={styles.meta}>{new Date(snippet.updated_at).toLocaleDateString()}</span>
        <div className={styles.footerActions}>
          <button className={copied ? styles.copied : styles.copy} onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button className={styles.del} onClick={() => onDelete(snippet.id)}>Delete</button>
        </div>
      </div>
    </div>
  );
}
