import React, { useEffect, useRef, useState } from 'react';
import { renderMarkdown } from '../lib/markdown';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import CitationList from './CitationList';
import styles from './StreamResponse.module.css';

const ACTION_LABELS = {
  explain:   'Explanation',
  summarize: 'Summary',
  refactor:  'Refactor Draft',
  convert:   'Language Conversion',
};

function extractCodeBlock(text) {
  const match = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

function stripCodeBlocks(text) {
  return text.replace(/```(?:\w+)?\n[\s\S]*?```/g, '').trim();
}

export default function StreamResponse({ snippetId, action, model, language, targetLanguage, snippetTitle, onClose, onApplied }) {
  const [tokens, setTokens] = useState('');
  const [citations, setCitations] = useState([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const esRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    let url = `/api/stream/${action}/${snippetId}?model=${encodeURIComponent(model)}&token=${encodeURIComponent(token)}`;
    if (action === 'convert' && targetLanguage) url += `&target_lang=${encodeURIComponent(targetLanguage)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.error) { setError(data.error); es.close(); setDone(true); return; }
      if (data.token) setTokens(prev => prev + data.token);
      if (data.done)  { setCitations(data.citations || []); setDone(true); es.close(); }
    };

    es.onerror = () => { setError('Stream connection lost'); es.close(); setDone(true); };
    return () => es.close();
  }, [snippetId, action, model]);

  const handleApply = async () => {
    const extracted = extractCodeBlock(tokens);
    if (!extracted) { toast('No code block found in refactor response', 'warning'); return; }
    setApplying(true);
    try {
      await api.put(`/snippets/${snippetId}`, { code: extracted });
      toast('Refactor applied and saved', 'success');
      if (onApplied) onApplied(extracted);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setApplying(false);
    }
  };

  const isRefactor = action === 'refactor';
  const isConvert  = action === 'convert';
  const isCodeAction = isRefactor || isConvert;
  const extractedCode = done && isCodeAction ? extractCodeBlock(tokens) : null;
  const explanation   = done && isCodeAction ? stripCodeBlocks(tokens) : null;
  const codeLabel = isConvert ? (targetLanguage || 'converted') : (language || 'code');

  const handleSaveConverted = async () => {
    if (!extractedCode) { toast('No code block found', 'warning'); return; }
    setSaving(true);
    try {
      const suggest = await api.post('/assistant/suggest', {
        code: extractedCode,
        language: targetLanguage,
      }).catch(() => ({
        title: `${snippetTitle || 'Snippet'} (${targetLanguage})`,
        description: `${snippetTitle || 'Snippet'} converted from ${language} to ${targetLanguage}.`,
      }));

      const newSnippet = await api.post('/snippets', {
        title: suggest.title || `${snippetTitle} (${targetLanguage})`,
        description: suggest.description || '',
        code: extractedCode,
        language: targetLanguage,
        visibility: 'private',
      });

      toast(`Saved as "${newSnippet.title}"`, 'success');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toHtml = (text) => ({ __html: renderMarkdown(text) });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}>✦</span>
            <span className={styles.headerTitle}>{ACTION_LABELS[action] || action}</span>
          {isConvert && targetLanguage && (
            <span className={styles.headerSub}>→ {targetLanguage}</span>
          )}
            {!done && <span className={styles.streaming}>generating…</span>}
          </div>
          <div className={styles.headerActions}>
            {!done && (
              <button className={styles.cancelBtn} onClick={() => { esRef.current?.close(); setDone(true); }}>
                Cancel
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* body */}
        <div className={styles.body}>
          {error && <p className={styles.error}>{error}</p>}

          {/* streaming — show raw while tokens accumulate */}
          {!done && tokens && (
            <div className={styles.streamingText}>
              {tokens}
              <span className={styles.cursor}>▌</span>
            </div>
          )}

          {/* done — render markdown */}
          {done && !isRefactor && tokens && (
            <div
              className={styles.markdown}
              dangerouslySetInnerHTML={toHtml(tokens)}
            />
          )}

          {/* done — refactor / convert split view */}
          {done && isCodeAction && (
            <div className={styles.refactorLayout}>
              {/* if no code block, the model refused — show explanation prominently */}
              {!extractedCode && explanation && (
                <div className={styles.refusalCard}>
                  <div className={styles.refusalIcon}>⚠</div>
                  <div
                    className={styles.markdown}
                    dangerouslySetInnerHTML={toHtml(explanation)}
                  />
                </div>
              )}

              {/* explanation alongside the code (only when code was produced) */}
              {extractedCode && explanation && (
                <div
                  className={styles.markdown}
                  dangerouslySetInnerHTML={toHtml(explanation)}
                />
              )}

              {extractedCode && (
                <div className={styles.codeSection}>
                  <div className={styles.codeHeader}>
                    <span className={styles.codeLabel}>{codeLabel}</span>
                    <div className={styles.codeActions}>
                      {isRefactor && (
                        <button className={styles.applyBtn} onClick={handleApply} disabled={applying}>
                          {applying ? 'Applying…' : '⬇ Apply & Save'}
                        </button>
                      )}
                      {isConvert && (
                        <button className={styles.applyBtn} onClick={handleSaveConverted} disabled={saving}>
                          {saving ? 'Saving…' : '＋ Save as new snippet'}
                        </button>
                      )}
                    </div>
                  </div>
                  <pre className={styles.codeBlock}>{extractedCode}</pre>
                </div>
              )}
            </div>
          )}

          {done && citations.length > 0 && (
            <div className={styles.citations}>
              <CitationList citations={citations} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
