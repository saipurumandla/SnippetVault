import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Search } from 'lucide-react';
import { isTypingTarget } from '../lib/keyboard';
import styles from './Header.module.css';

interface Props {
  onSearch?: (value: string) => void;
  searchValue?: string;
}

export default function Header({ onSearch, searchValue }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/' && onSearch) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        navigate('/snippet/new');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, onSearch]);

  return (
    <header className={styles.header}>
      {onSearch ? (
        <label className={styles.search}>
          <Search size={16} strokeWidth={1.75} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.searchInput}
            placeholder="Search snippets"
            aria-label="Search snippets"
            value={searchValue || ''}
            onChange={e => onSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') e.currentTarget.blur(); }}
          />
          <kbd>/</kbd>
        </label>
      ) : (
        <div className={styles.spacer} />
      )}
      <span className={styles.paletteHint}>
        <kbd>Ctrl</kbd> <kbd>K</kbd> commands
      </span>
      <button className={`btn-primary ${styles.newBtn}`} onClick={() => navigate('/snippet/new')} title="New snippet (N)">
        <Plus size={16} strokeWidth={1.75} />
        New snippet
      </button>
    </header>
  );
}
