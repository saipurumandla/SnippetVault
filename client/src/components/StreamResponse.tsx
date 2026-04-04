import { useEffect, useRef, useState } from 'react';
import { renderMarkdown } from '../lib/markdown';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { TriangleAlert, X } from 'lucide-react';
import { languageLabel } from '../lib/languages';
import CitationList from './CitationList';
import { useEscape } from './useEscape';
import styles from './StreamResponse.module.css';
import { errorMessage } from '../lib/errors';
import type { AiAction, Citation, Snippet } from '../types';

const ACTION_LABELS: Record<AiAction, string> = {
  explain: 'Explanation',
  summarize: 'Summary',
  refactor: 'Refactor draft',
  convert: 'Conversion',
};

function extractCodeBlock(text: string): string | null {
  const match = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
  return match?.[1] ? match[1].trim() : null;
}

function stripCodeBlocks(text: string): string {
  return text.replace(/```(?:\w+)?\n[\s\S]*?```/g, '').trim();
}

interface Props {
  snippetId: string;
  action: AiAction;
  model: string;
  language: string;
  targetLanguage?: string;
  snippetTitle?: string;
  onClose: () => void;
  onApplied?: (code: string) => void;
}

export default function StreamResponse({ snippetId, action, model, language, targetLanguage, snippetTitle, onClose, onApplied }: Props) {
  const [tokens, setTokens] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  useEscape(onClose);
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
    if (!extracted) { toast('The answer has no code block to apply', 'warning'); return; }
    setApplying(true);
    try {
      await api.put(`/snippets/${snippetId}`, { code: extracted });
      toast('Refactor saved', 'success');
      if (onApplied) onApplied(extracted);
      onClose();
    } catch (err) {
      toast(errorMessage(err), 'error');
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
      const suggest = await api.post<{ title?: string; description?: string }>('/assistant/suggest', {
        code: extractedCode,
        language: targetLanguage,
      }).catch(() => ({
        title: `${snippetTitle || 'Snippet'} (${targetLanguage})`,
        description: `${snippetTitle || 'Snippet'} converted from ${language} to ${targetLanguage}.`,
      }));

      const newSnippet = await api.post<Snippet>('/snippets', {
        title: suggest.title || `${snippetTitle} (${targetLanguage})`,
        description: suggest.description || '',
        code: extractedCode,
        language: targetLanguage,
        visibility: 'private',
      });

      toast(`Saved as "${newSnippet.title}"`, 'success');
      onClose();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toHtml = (text: string) => ({ __html: renderMarkdown(text) });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ai-title" onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 id="ai-title" className={styles.headerTitle}>
            {ACTION_LABELS[action]}
            {isConvert && targetLanguage && <span className={styles.headerSub}>to {languageLabel(targetLanguage)}</span>}
          </h2>
          {!done && <span className={styles.streaming}>Writing…</span>}
          <div className={styles.headerActions}>
            {!done && (
              <button className="btn-ghost" onClick={() => { esRef.current?.close(); setDone(true); }}>Stop</button>
            )}
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {error && <p className={styles.error} role="alert">{error}</p>}

          {!done && tokens && <div className={styles.streamingText}>{tokens}</div>}

          {done && !isCodeAction && tokens && (
            <div className={styles.markdown} dangerouslySetInnerHTML={toHtml(tokens)} />
          )}

          {done && isCodeAction && (
            <div className={styles.codeLayout}>
              {!extractedCode && explanation && (
                <div className={styles.refusal}>
                  <TriangleAlert size={16} strokeWidth={1.75} className={styles.refusalIcon} />
                  <div className={styles.markdown} dangerouslySetInnerHTML={toHtml(explanation)} />
                </div>
              )}
              {extractedCode && explanation && (
                <div className={styles.markdown} dangerouslySetInnerHTML={toHtml(explanation)} />
              )}
              {extractedCode && (
                <div className={styles.codeSection}>
                  <div className={styles.codeHeader}>
                    <span className={styles.codeLabel}>{languageLabel(codeLabel)}</span>
                    {isRefactor && (
                      <button className="btn-primary" onClick={handleApply} disabled={applying}>
                        {applying ? 'Saving…' : 'Apply and save'}
                      </button>
                    )}
                    {isConvert && (
                      <button className="btn-primary" onClick={handleSaveConverted} disabled={saving}>
                        {saving ? 'Saving…' : 'Save as new snippet'}
                      </button>
                    )}
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
