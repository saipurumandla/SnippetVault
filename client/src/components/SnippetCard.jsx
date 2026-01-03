import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import styles from './SnippetCard.module.css';

const LANG_COLORS = {
  javascript: '#f5a623', typescript: '#38bdf8', python: '#10d98a',
  bash: '#a78bfa',       sql: '#c084fc',        go: '#00d4e8',
  rust: '#fb923c',       java: '#f87171',       css: '#67e8f9',
  html: '#fda4af',       csharp: '#818cf8',     cpp: '#f43f5e',
};

export default function SnippetCard({ snippet, onDelete }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [copyTimer, setCopyTimer] = useState(null);

  if (!snippet?.id) return null;

  const isSensitive = snippet.encryption_mode === 'sensitive';
  const langColor = LANG_COLORS[snippet.language] || '#14b8a6';

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (isSensitive) {
      toast('Open the snippet to copy sensitive content', 'warning');
      return;
    }
    await navigator.clipboard.writeText(snippet.code);
    api.post(`/snippets/${snippet.id}/copy`, {}).catch(() => {});
    setCopied(true);
    const t = setTimeout(() => setCopied(false), 2000);
    setCopyTimer(t);
    toast('Copied to clipboard', 'success');
  };

  const tags = Array.isArray(snippet.tags) ? snippet.tags.filter(Boolean) : [];

  return (
    <div
      className={`${styles.card} ${isSensitive ? styles.sensitive : ''}`}
      onClick={() => navigate(`/snippet/${snippet.id}`)}
      style={{ '--lang-color': langColor }}
    >
      <div className={styles.topBar} style={{ background: langColor }} />

      <div className={styles.header}>
        <div className={styles.titleRow}>
          {isSensitive && <span className={styles.lockIcon} title="Sensitive — client-side encrypted">🔒</span>}
          <span className={styles.title}>{snippet.title}</span>
        </div>
        <div className={styles.badges}>
          <span className={styles.langBadge} style={{ color: langColor, borderColor: `${langColor}30` }}>
            {snippet.language}
          </span>
          {isSensitive && (
            <span className="badge badge-amber">🔒 sensitive</span>
          )}
        </div>
      </div>

      {snippet.description && <p className={styles.desc}>{snippet.description}</p>}

      <pre className={styles.preview}>
        {isSensitive ? '••••••••••••••••••••••••••••\n(encrypted — click to unlock)' : snippet.code.slice(0, 140) + (snippet.code.length > 140 ? '…' : '')}
      </pre>

      {tags.length > 0 && (
        <div className={styles.tags}>
          {tags.slice(0, 4).map(t => (
            <span key={t} className={styles.tag} onClick={e => e.stopPropagation()}>{t}</span>
          ))}
          {tags.length > 4 && <span className={styles.tagMore}>+{tags.length - 4}</span>}
        </div>
      )}

      <div className={styles.footer} onClick={e => e.stopPropagation()}>
        <span className={styles.date}>{new Date(snippet.updated_at).toLocaleDateString()}</span>
        <div className={styles.footerActions}>
          {snippet.copy_count > 0 && (
            <span className={styles.copyCount}>{snippet.copy_count} copies</span>
          )}
          <button className={copied ? styles.copiedBtn : styles.copyBtn} onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); onDelete(snippet.id); }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
