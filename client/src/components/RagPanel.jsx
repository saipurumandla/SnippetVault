import React, { useState } from 'react';
import { api } from '../lib/api';
import CitationList from './CitationList';
import styles from './RagPanel.module.css';

export default function RagPanel() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lowConfidence, setLowConfidence] = useState(false);

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

  return (
    <div className={styles.panel}>
      <p className={styles.heading}>Ask about your snippets</p>
      <form className={styles.form} onSubmit={handleAsk}>
        <input
          className={styles.input}
          placeholder="e.g. How do I authenticate with the GitHub API?"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          disabled={loading}
        />
        <button className={styles.btn} type="submit" disabled={loading || !question.trim()}>
          {loading ? '…' : 'Ask'}
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
      {answer && (
        <div className={styles.answerCard}>
          {lowConfidence && <p className={styles.warning}>Low confidence — results may be incomplete.</p>}
          <p className={styles.answerText}>{answer}</p>
          <CitationList citations={citations} />
        </div>
      )}
    </div>
  );
}
