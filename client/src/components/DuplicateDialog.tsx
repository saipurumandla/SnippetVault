import { useEscape } from './useEscape';
import styles from './Dialog.module.css';
import own from './DuplicateDialog.module.css';

export interface Similar {
  id: number;
  title: string;
  language: string;
  similarity: number;
}

export default function DuplicateDialog({ matches, onOpen, onSaveAnyway, onCancel }: {
  matches: Similar[];
  onOpen: (id: number) => void;
  onSaveAnyway: () => void;
  onCancel: () => void;
}) {
  useEscape(onCancel);
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="dup-title" onClick={e => e.stopPropagation()}>
        <h2 id="dup-title" className={styles.title}>You may already have this</h2>
        <p className={styles.text}>These snippets look almost the same. Open one instead of saving a copy?</p>
        <ul className={own.list}>
          {matches.map(m => (
            <li key={m.id}>
              <button className={own.match} onClick={() => onOpen(m.id)}>
                <span className={own.title}>{m.title}</span>
                <span className={own.meta}>#{m.id} · {m.language} · {m.similarity >= 1 ? 'same code' : `${Math.round(m.similarity * 100)}% similar`}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <button className="btn-ghost" onClick={onCancel}>Keep editing</button>
          <button className="btn-primary" onClick={onSaveAnyway} autoFocus>Save anyway</button>
        </div>
      </div>
    </div>
  );
}
