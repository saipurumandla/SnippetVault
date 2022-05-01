import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';
import styles from './CommandPalette.module.css';

const ACTIONS = [
  { id: 'new-snippet', label: 'New Snippet', type: 'action', path: '/snippet/new' },
  { id: 'settings', label: 'Go to Settings', type: 'action', path: '/settings' },
  { id: 'toggle-theme', label: 'Toggle Theme', type: 'action' },
];

function fuzzy(str, query) {
  return str.toLowerCase().includes(query.toLowerCase());
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [snippets, setSnippets] = useState([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { toggle: toggleTheme } = useTheme();

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      api.get('/snippets').then(setSnippets).catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const snippetItems = snippets
    .filter(s => fuzzy(s.title, query) || fuzzy(s.language, query))
    .slice(0, 6)
    .map(s => ({ id: `s-${s.id}`, label: s.title, type: 'snippet', secondary: s.language, path: `/snippet/${s.id}` }));

  const actionItems = ACTIONS.filter(a => !query || fuzzy(a.label, query));
  const items = [...snippetItems, ...actionItems];

  const handleSelect = (item) => {
    setOpen(false);
    if (item.id === 'toggle-theme') { toggleTheme(); return; }
    if (item.path) navigate(item.path);
  };

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, items.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && items[active]) handleSelect(items[active]);
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className={styles.input}
          placeholder="Search snippets or type a command…"
          value={query}
          onChange={e => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={handleKey}
        />
        {items.length > 0 && (
          <ul className={styles.list}>
            {items.map((item, i) => (
              <li
                key={item.id}
                className={i === active ? styles.itemActive : styles.item}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setActive(i)}
              >
                <span className={styles.itemLabel}>{item.label}</span>
                <span className={styles.badge}>{item.type}</span>
              </li>
            ))}
          </ul>
        )}
        {items.length === 0 && query && (
          <p className={styles.empty}>No results</p>
        )}
      </div>
    </div>
  );
}
