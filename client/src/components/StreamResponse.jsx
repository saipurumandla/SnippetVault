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
      if (data.error) { setError(data.error); es.close(); return; }
      if (data.token) setTokens(prev => prev + data.token);
      if (data.done) {
        setCitations(data.citations || []);
        setDone(true);
        es.close();
      }
    };

    es.onerror = () => { setError('Connection error'); es.close(); };
    return () => es.close();
  }, [snippetId, action, model]);

  const handleCancel = () => {
    esRef.current?.close();
    setDone(true);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tokens);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <span className={styles.label}>{action}</span>
        <div className={styles.actions}>
          {done && (
            <button className={copied ? styles.copied : styles.copy} onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          {!done && <button className={styles.cancel} onClick={handleCancel}>Cancel</button>}
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <pre className={styles.output}>{tokens || (done ? '' : '…')}</pre>
      {done && <CitationList citations={citations} />}
    </div>
  );
}
