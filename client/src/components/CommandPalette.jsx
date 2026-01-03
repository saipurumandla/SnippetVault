import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Plus, FolderOpen, ShieldCheck, HardDrive, Settings2, BookOpen, Archive, Tag, Search } from 'lucide-react';
import styles from './CommandPalette.module.css';

const ACTIONS = [
  { id: 'new-snippet', label: 'New Snippet',      type: 'action', Icon: Plus,        path: '/snippet/new' },
  { id: 'new-project', label: 'New Project',      type: 'action', Icon: FolderOpen,  path: '/projects' },
  { id: 'projects',    label: 'Go to Projects',   type: 'action', Icon: FolderOpen,  path: '/projects' },
  { id: 'security',    label: 'Security Events',  type: 'action', Icon: ShieldCheck, path: '/security' },
  { id: 'backup',      label: 'Backup & Restore', type: 'action', Icon: HardDrive,   path: '/backup' },
  { id: 'settings',    label: 'Settings',         type: 'action', Icon: Settings2,   path: '/settings' },
  { id: 'docs',        label: 'Documentation',    type: 'action', Icon: BookOpen,    path: '/docs' },
];

function fuzzy(str, q) {
  if (!q) return true;
  return str.toLowerCase().includes(q.toLowerCase());
}

const TYPE_COLORS = { snippet: 'badge-teal', project: 'badge-sky', tag: 'badge-violet', action: 'badge-indigo' };

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [snippets, setSnippets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tags, setTags] = useState([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

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
    if (!open) return;
    setQuery('');
    setActive(0);
    api.get('/snippets').then(setSnippets).catch(() => {});
    api.get('/projects').then(setProjects).catch(() => {});
    api.get('/tags').then(setTags).catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const snippetItems = snippets.filter(s => fuzzy(s.title, query) || fuzzy(s.language, query))
    .slice(0, 5).map(s => ({ id: `s-${s.id}`, label: s.title, secondary: s.language, type: 'snippet', Icon: Archive, path: `/snippet/${s.id}` }));

  const projectItems = projects.filter(p => fuzzy(p.name, query))
    .slice(0, 3).map(p => ({ id: `p-${p.id}`, label: p.name, type: 'project', Icon: FolderOpen, path: '/projects' }));

  const tagItems = (Array.isArray(tags) ? tags : []).filter(t => fuzzy(t, query))
    .slice(0, 3).map(t => ({ id: `t-${t}`, label: `#${t}`, type: 'tag', Icon: Tag, path: `/vault?tag=${t}` }));

  const actionItems = ACTIONS.filter(a => fuzzy(a.label, query));
  const items = [...snippetItems, ...projectItems, ...tagItems, ...actionItems];

  const select = (item) => {
    setOpen(false);
    if (item.path) navigate(item.path);
  };

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, items.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && items[active]) select(items[active]);
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.inputRow}>
          <Search size={16} className={styles.inputIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search snippets, projects, tags, or run a command…"
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={handleKey}
          />
          <span className={styles.kbdEsc}>Esc</span>
        </div>
        {items.length > 0 ? (
          <ul className={styles.list}>
            {items.map((item, i) => (
              <li
                key={item.id}
                className={`${styles.item} ${i === active ? styles.itemActive : ''}`}
                onClick={() => select(item)}
                onMouseEnter={() => setActive(i)}
              >
                {item.Icon && <item.Icon size={15} className={styles.itemIcon} />}
                <span className={styles.itemLabel}>{item.label}</span>
                {item.secondary && <span className={styles.itemSecondary}>{item.secondary}</span>}
                <span className={`badge ${TYPE_COLORS[item.type] || 'badge-indigo'} ${styles.typeBadge}`}>{item.type}</span>
              </li>
            ))}
          </ul>
        ) : query ? (
          <p className={styles.empty}>No results for "{query}"</p>
        ) : null}
        <div className={styles.footer}>
          <span>↑↓ navigate</span>
          <span>Enter select</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
}
