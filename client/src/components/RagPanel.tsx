import { useEffect, useRef, useState, type FormEvent } from 'react';
import { renderMarkdown } from '../lib/markdown';
import { api } from '../lib/api';
import SnippetPreviewModal from './SnippetPreviewModal';
import styles from './RagPanel.module.css';
import { errorMessage } from '../lib/errors';
import type { Citation } from '../types';

export default function RagPanel() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lowConfidence, setLowConfidence] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = bodyRef.current;
    if (!container) return;
    // chips come from renderMarkdown html, so listen on the container
    const handler = (e: MouseEvent) => {
      const chip = (e.target as HTMLElement).closest('.snip-ref');
      if (chip) {
        const id = chip.getAttribute('data-snip-id');
        if (id) setPreviewId(id);
      }
    };
    container.addEventListener('click', handler);
    return () => container.removeEventListener('click', handler);
  }, [answer]);

  const handleAsk = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError('');
    setAnswer('');
    setCitations([]);
    try {
      const result = await api.post<{ answer: string; citations?: Citation[]; lowConfidence?: boolean }>('/rag/ask', { question });
      setAnswer(result.answer);
      setCitations(result.citations || []);
      setLowConfidence(!!result.lowConfidence);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const uniqueCitations = citations.filter(
    (c, i, arr) => arr.findIndex(x => x.snippetId === c.snippetId) === i
  );

  return (
    <>
      {previewId && (
        <SnippetPreviewModal snippetId={previewId} onClose={() => setPreviewId(null)} />
      )}

      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.icon}>✦</span>
          <span className={styles.title}>Ask about your snippets</span>
          <span className="badge badge-sensitive" style={{ marginLeft: 'auto' }}>RAG · Local Ollama</span>
        </div>

        <form className={styles.form} onSubmit={handleAsk}>
          <input
            className="input"
            placeholder="e.g. How do I format a date? What snippets use async/await?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            disabled={loading}
          />
          <button className="btn-primary" type="submit" disabled={loading || !question.trim()}>
            {loading ? '…' : 'Ask'}
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}

        {answer && (
          <div className={styles.answerCard}>
            {lowConfidence && (
              <div className={styles.lowConf}>
                ⚠ Low confidence — index more snippets or refine your question.
              </div>
            )}

            <div
              ref={bodyRef}
              className={styles.answerText}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(answer) }}
            />

            {uniqueCitations.length > 0 && (
              <div className={styles.sources}>
                <p className={styles.sourcesLabel}>Sources</p>
                <div className={styles.sourceChips}>
                  {uniqueCitations.map(c => (
                    <button
                      key={c.snippetId}
                      className={styles.sourceChip}
                      onClick={() => setPreviewId(String(c.snippetId))}
                    >
                      <span className={styles.sourceId}>#{c.snippetId}</span>
                      <span className={styles.sourceTitle}>{c.title}</span>
                      {c.language && <span className={styles.sourceLang}>{c.language}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
