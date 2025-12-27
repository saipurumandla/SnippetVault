import React, { useEffect, useRef, useState } from 'react';
import CitationList from './CitationList';
import styles from './StreamResponse.module.css';

export default function StreamResponse({ snippetId, action, model, onClose }) {
  const [tokens, setTokens] = useState('');
  const [citations, setCitations] = useState([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const esRef = useRef(null);

  useEffect(() => {
    const url = `/api/stream/${action}/${snippetId}?model=${encodeURIComponent(model)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.error) { setError(data.error); es.close(); setDone(true); return; }
      if (data.token) setTokens(prev => prev + data.token);
      if (data.done) { setCitations(data.citations || []); setDone(true); es.close(); }
    };

    es.onerror = () => { setError('Stream connection lost'); es.close(); setDone(true); };
    return () => es.close();
  }, [snippetId, action, model]);

  const handleCancel = () => { esRef.current?.close(); setDone(true); };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tokens);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ACTION_LABELS = { explain: 'Explanation', summarize: 'Summary', refactor: 'Refactor draft' };

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <span className={styles.actionLabel}>{ACTION_LABELS[action] || action}</span>
        {!done && <span className={styles.streaming}>streaming…</span>}
        <div className={styles.toolbarActions}>
          {done && tokens && (
            <button className={`${styles.copyBtn} ${copied ? styles.copiedBtn : ''}`} onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          )}
          {!done && (
            <button className={styles.cancelBtn} onClick={handleCancel}>Cancel</button>
          )}
          <button className={styles.closeBtn} onClick={onClose} title="Close">✕</button>
        </div>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <pre className={styles.output}>{tokens || (!done ? '…' : '')}</pre>
      {done && citations.length > 0 && <CitationList citations={citations} />}
    </div>
  );
}
