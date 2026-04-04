import { useNavigate } from 'react-router';
import type { Citation } from '../types';
import styles from './CitationList.module.css';

export default function CitationList({ citations }: { citations: Citation[] }) {
  const navigate = useNavigate();
  const unique = citations.filter((c, i, all) => all.findIndex(x => x.snippetId === c.snippetId) === i);
  if (unique.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Sources</span>
      {unique.map(c => (
        <button key={c.snippetId} className={styles.chip} onClick={() => navigate(`/snippet/${c.snippetId}`)}>
          {c.title}
          <span className={styles.id}>#{c.snippetId}</span>
        </button>
      ))}
    </div>
  );
}
