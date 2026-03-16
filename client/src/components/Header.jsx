import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import styles from './Header.module.css';

export default function Header({ onSearch, searchValue }) {
  const navigate = useNavigate();

  return (
    <header className={styles.header}>
      <div className={styles.search}>
        <span className={styles.searchIcon}>⌕</span>
        <input
          className={styles.searchInput}
          placeholder="Search snippets… (Ctrl+K for command palette)"
          value={searchValue || ''}
          onChange={e => onSearch && onSearch(e.target.value)}
        />
      </div>
      <button className={`btn-primary ${styles.newBtn}`} onClick={() => navigate('/snippet/new')}>
        + New Snippet
      </button>
    </header>
  );
}
