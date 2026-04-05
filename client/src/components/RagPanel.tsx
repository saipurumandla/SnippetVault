import { useEffect, useRef, useState, type FormEvent } from 'react';
import { TriangleAlert } from 'lucide-react';
import { renderMarkdown } from '../lib/markdown';
import { api } from '../lib/api';
import styles from './RagPanel.module.css';
import { errorMessage } from '../lib/errors';
import type { Citation } from '../types';

export default function RagPanel({ onCite }: { onCite: (snippetId: number) => void }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lowConfidence, setLowConfidence] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = bodyRef.current;
    if (!container) return;
    // chips are raw html, so listen on container
    const handler = (e: MouseEvent) => {
      const chip = (e.target as HTMLElement).closest('.snip-ref');
      if (chip) {
        const id = chip.getAttribute('data-snip-id');
        if (id) onCite(Number(id));
      }
    };
    container.addEventListener('click', handler);
    return () => container.removeEventListener('click', handler);
  }, [answer, onCite]);

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
    <div className={styles.panel}>
      <form className={styles.form} onSubmit={handleAsk}>
        <label className="sr-only" htmlFor="ask">Question</label>
        <input
          id="ask"
          className="input"
          placeholder="Ask about your snippets, for example: how do we retry http calls?"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          disabled={loading}
          autoFocus
        />
        <button className="btn-primary" type="submit" disabled={loading || !question.trim()}>
          {loading ? 'Asking…' : 'Ask'}
        </button>
      </form>
      <p className={styles.hint}>Answers come from your local Ollama and only use snippets you can read.</p>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {answer && (
        <div className={styles.answer}>
          {lowConfidence && (
            <p className={styles.lowConf}>
              <TriangleAlert size={14} strokeWidth={1.75} />
              Not enough matching snippets. Try other words, or add the snippet first.
            </p>
          )}
          <div ref={bodyRef} className={styles.answerText} dangerouslySetInnerHTML={{ __html: renderMarkdown(answer) }} />
          {uniqueCitations.length > 0 && (
            <div className={styles.sources}>
              <span className={styles.sourcesLabel}>Sources</span>
              {uniqueCitations.map(c => (
                <button key={c.snippetId} className={styles.source} onClick={() => onCite(c.snippetId)}>
                  {c.title}
                  <span className={styles.sourceMeta}>#{c.snippetId}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
