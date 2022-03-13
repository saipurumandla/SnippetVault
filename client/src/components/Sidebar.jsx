import React from 'react';
import styles from './Sidebar.module.css';

const LANGUAGES = ['javascript', 'typescript', 'python', 'bash', 'sql', 'json', 'yaml', 'html', 'css', 'go', 'rust', 'java', 'csharp', 'cpp', 'markdown', 'plaintext'];

export default function Sidebar({ selectedLang, onLangChange }) {
  return (
    <aside className={styles.sidebar}>
      <p className={styles.label}>Language</p>
      <button
        className={selectedLang === '' ? styles.itemActive : styles.item}
        onClick={() => onLangChange('')}
      >
        All
      </button>
      {LANGUAGES.map(l => (
        <button
          key={l}
          className={selectedLang === l ? styles.itemActive : styles.item}
          onClick={() => onLangChange(l)}
        >
          {l}
        </button>
      ))}
    </aside>
  );
}
