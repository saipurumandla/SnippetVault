import type { Ref } from 'react';
import { Lock } from 'lucide-react';
import { languageLabel } from '../lib/languages';
import { shortDate } from '../lib/dates';
import type { Snippet } from '../types';
import styles from './SnippetRow.module.css';

interface Props {
  snippet: Snippet;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  ref?: Ref<HTMLLIElement>;
}

export default function SnippetRow({ snippet, selected, onSelect, onOpen, ref }: Props) {
  const sensitive = snippet.encryption_mode === 'sensitive';
  return (
    <li
      ref={ref}
      role="option"
      aria-selected={selected}
      className={`${styles.row} ${selected ? styles.selected : ''}`}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      <span className={styles.title}>
        {sensitive && <Lock size={14} strokeWidth={1.75} className={styles.lock} aria-label="Sensitive" />}
        {snippet.title}
      </span>
      <span className={styles.lang}>{languageLabel(snippet.language)}</span>
      <span className={styles.tags}>{snippet.tags.join(', ')}</span>
      <time className={styles.date} dateTime={snippet.updated_at}>{shortDate(snippet.updated_at)}</time>
    </li>
  );
}
