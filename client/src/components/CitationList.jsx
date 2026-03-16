import React from 'react';
import { useNavigate } from 'react-router';
import styles from './CitationList.module.css';

export default function CitationList({ citations }) {
  const navigate = useNavigate();
  if (!citations || citations.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>Sources</p>
      <div className={styles.chips}>
        {citations.map(c => (
          <button
            key={c.snippetId}
            className={styles.chip}
            onClick={() => navigate(`/snippet/${c.snippetId}`)}
          >
            <span className={styles.chipId}>#{c.snippetId}</span>
            <span className={styles.chipTitle}>{c.title}</span>
            {c.language && <span className={styles.chipLang}>{c.language}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
