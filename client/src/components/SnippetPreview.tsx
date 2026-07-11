import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Copy, Check, Pencil, Trash2, ExternalLink, Lock } from 'lucide-react';
import { vault } from '../lib/vault';
import { languageLabel } from '../lib/languages';
import { longDate } from '../lib/dates';
import { useToast } from '../context/ToastContext';
import type { Snippet } from '../types';
import styles from './SnippetPreview.module.css';

interface Props {
  snippet: Snippet;
  onDelete: (id: number) => void;
}

export default function SnippetPreview({ snippet, onDelete }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const sensitive = snippet.encryption_mode === 'sensitive';

  const copy = async () => {
    await navigator.clipboard.writeText(snippet.code);
    vault.snippets.copied(snippet.id).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast('Code copied', 'success');
  };

  return (
    <section className={styles.pane} aria-label="Snippet preview">
      <div className={styles.head}>
        <h2 className={styles.title}>{snippet.title}</h2>
        <div className={styles.actions}>
          {!sensitive && (
            <button className="btn-ghost" onClick={copy}>
              {copied ? <Check size={16} strokeWidth={1.75} /> : <Copy size={16} strokeWidth={1.75} />}
              Copy code
            </button>
          )}
          <button className="btn-ghost" onClick={() => navigate(`/snippet/${snippet.id}/edit`)}>
            <Pencil size={16} strokeWidth={1.75} />
            Edit
          </button>
          <button className="btn-ghost" onClick={() => navigate(`/snippet/${snippet.id}`)} title="Open (Enter)">
            <ExternalLink size={16} strokeWidth={1.75} />
            Open
          </button>
          <button className="btn-danger" onClick={() => onDelete(snippet.id)} aria-label="Delete snippet" title="Delete snippet">
            <Trash2 size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <p className={styles.meta}>
        {languageLabel(snippet.language)} · {snippet.visibility} · updated {longDate(snippet.updated_at)}
        {snippet.copy_count > 0 && ` · copied ${snippet.copy_count}×`}
      </p>
      {snippet.description && <p className={styles.desc}>{snippet.description}</p>}
      {snippet.tags.length > 0 && (
        <div className={styles.tags}>
          {snippet.tags.map(t => <span key={t} className="badge">{t}</span>)}
        </div>
      )}

      {sensitive ? (
        <div className={styles.locked}>
          <Lock size={16} strokeWidth={1.75} />
          Encrypted in your browser. Open the snippet to unlock it.
        </div>
      ) : (
        <pre className={styles.code}><code>{snippet.code}</code></pre>
      )}
    </section>
  );
}
