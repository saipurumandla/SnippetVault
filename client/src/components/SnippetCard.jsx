import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SnippetCard.module.css';

export default function SnippetCard({ snippet, onDelete }) {
  const navigate = useNavigate();

  return (
    <div className={styles.card} onClick={() => navigate(`/snippet/${snippet.id}`)}>
      <div className={styles.header}>
        <span className={styles.title}>{snippet.title}</span>
        <span className={styles.lang}>{snippet.language}</span>
      </div>
      {snippet.description && (
        <p className={styles.desc}>{snippet.description}</p>
      )}
      <pre className={styles.preview}>{snippet.code.slice(0, 120)}{snippet.code.length > 120 ? '…' : ''}</pre>
      <div className={styles.footer} onClick={e => e.stopPropagation()}>
        <span className={styles.meta}>{new Date(snippet.updated_at).toLocaleDateString()}</span>
        <button className={styles.del} onClick={() => onDelete(snippet.id)}>Delete</button>
      </div>
    </div>
  );
}
