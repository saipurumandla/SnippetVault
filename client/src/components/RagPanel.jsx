import React, { useEffect, useRef, useState } from 'react';
import { renderMarkdown } from '../lib/markdown';
import { api } from '../lib/api';
import SnippetPreviewModal from './SnippetPreviewModal';
import styles from './RagPanel.module.css';

export default function RagPanel() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lowConfidence, setLowConfidence] = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const bodyRef = useRef(null);

  // event delegation — catches clicks on .snip-ref chips injected by renderMarkdown
  useEffect(() => {
    const container = bodyRef.current;
    if (!container) return;
    const handler = (e) => {
      const chip = e.target.closest('.snip-ref');
      if (chip) {
        const id = chip.getAttribute('data-snip-id');
        if (id) setPreviewId(id);
      }
    };
    container.addEventListener('click', handler);
    return () => container.removeEventListener('click', handler);
  }, [answer]);

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError('');
    setAnswer('');
    setCitations([]);
    try {
      const result = await api.post('/rag/ask', { question });
      setAnswer(result.answer);
      setCitations(result.citations || []);
      setLowConfidence(!!result.lowConfidence);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // deduplicate citations by snippetId
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
          <span className="badge badge-amber" style={{ marginLeft: 'auto' }}>RAG · Local Ollama</span>
        </div>

        <form className={styles.form} onSubmit={handleAsk}>
          <input
            className="input-glass"
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

            {/* rendered markdown with clickable [snippet:N] chips */}
            <div
              ref={bodyRef}
              className={styles.answerText}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(answer) }}
            />

            {/* source chips — click to open preview popup */}
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
