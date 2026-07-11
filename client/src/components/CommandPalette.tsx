import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { vault } from '../lib/vault';
import { Plus, FolderOpen, ShieldCheck, HardDrive, Settings2, BookOpen, Archive, Tag, Search, type LucideIcon } from 'lucide-react';
import styles from './CommandPalette.module.css';
import type { Project, Snippet } from '../types';

type ItemType = 'snippet' | 'project' | 'tag' | 'action';

interface PaletteItem {
  id: string;
  label: string;
  secondary?: string;
  type: ItemType;
  Icon: LucideIcon;
  path: string;
}

const ACTIONS: PaletteItem[] = [
  { id: 'new-snippet', label: 'New snippet',      type: 'action', Icon: Plus,        path: '/snippet/new' },
  { id: 'new-project', label: 'New project',      type: 'action', Icon: FolderOpen,  path: '/projects' },
  { id: 'projects',    label: 'Go to projects',   type: 'action', Icon: FolderOpen,  path: '/projects' },
  { id: 'security',    label: 'Security events',  type: 'action', Icon: ShieldCheck, path: '/security' },
  { id: 'backup',      label: 'Backup and restore', type: 'action', Icon: HardDrive,   path: '/backup' },
  { id: 'settings',    label: 'Settings',         type: 'action', Icon: Settings2,   path: '/settings' },
  { id: 'docs',        label: 'Documentation',    type: 'action', Icon: BookOpen,    path: '/docs' },
];

function fuzzy(str: string, q: string): boolean {
  if (!q) return true;
  return str.toLowerCase().includes(q.toLowerCase());
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
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
    vault.snippets.list().then(setSnippets).catch(() => {});
    vault.projects.list().then(setProjects).catch(() => {});
    vault.tags.list().then(setTags).catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const snippetItems = snippets.filter(s => fuzzy(s.title, query) || fuzzy(s.language, query))
    .slice(0, 5).map((s): PaletteItem => ({ id: `s-${s.id}`, label: s.title, secondary: s.language, type: 'snippet', Icon: Archive, path: `/snippet/${s.id}` }));

  const projectItems = projects.filter(p => fuzzy(p.name, query))
    .slice(0, 3).map((p): PaletteItem => ({ id: `p-${p.id}`, label: p.name, type: 'project', Icon: FolderOpen, path: '/projects' }));

  const tagItems = (Array.isArray(tags) ? tags : []).filter(t => fuzzy(t, query))
    .slice(0, 3).map((t): PaletteItem => ({ id: `t-${t}`, label: `#${t}`, type: 'tag', Icon: Tag, path: `/vault?tag=${t}` }));

  const actionItems = ACTIONS.filter(a => fuzzy(a.label, query));
  const items = [...snippetItems, ...projectItems, ...tagItems, ...actionItems];

  const select = (item: PaletteItem) => {
    setOpen(false);
    if (item.path) navigate(item.path);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, items.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    const current = items[active];
    if (e.key === 'Enter' && current) select(current);
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.inputRow}>
          <Search size={16} strokeWidth={1.75} className={styles.inputIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search snippets, projects, tags or commands"
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={handleKey}
          />
          <kbd>Esc</kbd>
        </div>
        {items.length > 0 ? (
          <ul className={styles.list} role="listbox">
            {items.map((item, i) => (
              <li
                key={item.id}
                className={`${styles.item} ${i === active ? styles.itemActive : ''}`}
                onClick={() => select(item)}
                onMouseEnter={() => setActive(i)}
              >
                <item.Icon size={16} strokeWidth={1.75} className={styles.itemIcon} />
                <span className={styles.itemLabel}>{item.label}</span>
                {item.secondary && <span className={styles.itemSecondary}>{item.secondary}</span>}
                <span className={styles.typeLabel}>{item.type}</span>
              </li>
            ))}
          </ul>
        ) : query ? (
          <p className={styles.empty}>Nothing matches “{query}”.</p>
        ) : null}
        <div className={styles.footer}>
          <span><kbd>↑</kbd> <kbd>↓</kbd> move</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
