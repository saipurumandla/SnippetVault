import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import styles from './SnippetPreviewModal.module.css';
import { errorMessage } from '../lib/errors';
import type { Snippet } from '../types';

interface Props {
  snippetId: string;
  onClose: () => void;
}

export default function SnippetPreviewModal({ snippetId, onClose }: Props) {
  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Snippet>(`/snippets/${snippetId}`)
      .then(setSnippet)
      .catch(err => setError(errorMessage(err)));
  }, [snippetId]);

  const handleViewFull = () => {
    onClose();
    navigate(`/snippet/${snippetId}`);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>Snippet Preview</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {!snippet && !error && (
          <p className={styles.loading}>Loading…</p>
        )}

        {snippet && (
          <div className={styles.body}>
            <div className={styles.meta}>
              <h2 className={styles.title}>{snippet.title}</h2>
              <div className={styles.badges}>
                <span className={`badge`}>{snippet.language}</span>
                <span className={`badge ${snippet.visibility === 'private' ? 'badge-danger' : snippet.visibility === 'project' ? 'badge' : 'badge-ok'}`}>
                  {snippet.visibility}
                </span>
                {snippet.encryption_mode === 'sensitive' && (
                  <span className="badge badge-sensitive">🔒 sensitive</span>
                )}
              </div>
            </div>

            {snippet.description && (
              <p className={styles.description}>{snippet.description}</p>
            )}

            {snippet.tags.filter(Boolean).length > 0 && (
              <div className={styles.tags}>
                {snippet.tags.filter(Boolean).map(t => (
                  <span key={t} className={styles.tag}>#{t}</span>
                ))}
              </div>
            )}

            <div className="md-code-block">
              <div className="md-code-header">
                <span className="md-code-lang">{snippet.language}</span>
                {snippet.encryption_mode !== 'sensitive' && (
                  <button className="md-code-copy" type="button">Copy</button>
                )}
              </div>
              <pre><code>
                {snippet.encryption_mode === 'sensitive'
                  ? '(sensitive — open full view to unlock)'
                  : snippet.code.slice(0, 600) + (snippet.code.length > 600 ? '\n…' : '')}
              </code></pre>
            </div>

            <button className="btn-primary" onClick={handleViewFull} style={{ width: '100%', marginTop: 4 }}>
              View full snippet →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
