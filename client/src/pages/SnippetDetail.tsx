import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import Editor from '@monaco-editor/react';
import { api } from '../lib/api';
import { decryptFromSender } from '../lib/crypto';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import PassphrasePrompt from '../components/PassphrasePrompt';
import ShareDialog from '../components/ShareDialog';
import StreamResponse from '../components/StreamResponse';
import ConfirmModal from '../components/ConfirmModal';
import Header from '../components/Header';
import styles from './SnippetDetail.module.css';
import { errorMessage } from '../lib/errors';
import type { AiAction, Snippet } from '../types';

const UNLOCK_TTL = 15 * 60 * 1000;
const CLIPBOARD_CLEAR = 45;

export default function SnippetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { toast } = useToast();

  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [decryptedCode, setDecryptedCode] = useState<string | null>(null);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction | null>(null);
  const [convertLang, setConvertLang] = useState('python');
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [ollamaModel, setOllamaModel] = useState('qwen3-coder:30b');
  const [clipTimer, setClipTimer] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const clipInterval = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!id || id === 'undefined') { navigate('/vault', { replace: true }); return; }

    api.get<Snippet>(`/snippets/${id}`)
      .then(s => {
        setSnippet(s);
        if (s.encryption_mode === 'sensitive') {
          const key = sessionStorage.getItem(`unlockKey-${s.id}`);
          if (key) performDecrypt(s, key);
          else setShowPassphrase(true);
        }
      })
      .catch(err => toast(errorMessage(err), 'error'));

    api.get<{ available: boolean; models: string[] }>('/assistant/models').then(d => {
      setOllamaAvailable(d.available);
      if (d.models[0]) setOllamaModel(d.models[0]);
    }).catch(() => {});

    return () => { clearTimeout(unlockTimer.current); clearInterval(clipInterval.current); };
  }, [id]);

  const performDecrypt = async (s: Snippet, privateKey: string) => {
    try {
      const payload = (s.wrapped_key ? JSON.parse(s.wrapped_key) : {}) as { nonce?: string };
      const senderPub = localStorage.getItem('encPublicKey');
      if (!senderPub || !payload.nonce) throw new Error('missing key material');
      const plain = await decryptFromSender({ ciphertext: s.code, nonce: payload.nonce }, senderPub, privateKey);
      setDecryptedCode(plain);
      sessionStorage.setItem(`unlockKey-${s.id}`, privateKey);
      clearTimeout(unlockTimer.current);
      unlockTimer.current = setTimeout(() => { setDecryptedCode(null); sessionStorage.removeItem(`unlockKey-${s.id}`); }, UNLOCK_TTL);
    } catch { toast('Decryption failed — wrong key or corrupted data', 'error'); }
  };

  const handleUnlock = async (privateKey: string) => {
    setShowPassphrase(false);
    if (snippet) await performDecrypt(snippet, privateKey);
  };

  const handleCopy = async () => {
    const code = displayCode;
    if (!code || code.startsWith('••')) { toast('Unlock snippet first', 'warning'); return; }

    if (isSensitive && !showCopyConfirm) {
      setShowCopyConfirm(true);
      return;
    }

    await navigator.clipboard.writeText(code);
    api.post(`/snippets/${id}/copy`, {}).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast('Copied', 'success');

    if (isSensitive) {
      let secs = CLIPBOARD_CLEAR;
      setClipTimer(secs);
      clearInterval(clipInterval.current);
      clipInterval.current = setInterval(() => {
        secs -= 1;
        setClipTimer(secs);
        if (secs <= 0) {
          clearInterval(clipInterval.current);
          setClipTimer(0);
          navigator.clipboard.writeText('').catch(() => {});
          toast('Clipboard cleared', 'info');
        }
      }, 1000);
    }
  };

  const handleDelete = () => setShowDeleteConfirm(true);

  const doDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      await api.del(`/snippets/${id}`);
      toast('Snippet deleted', 'success');
      navigate('/vault');
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  const doCopy = async () => {
    setShowCopyConfirm(false);
    await handleCopy();
  };

  if (!snippet) return (
    <div>
      <Header />
      <div className={styles.loading}>{showPassphrase ? '' : 'Loading…'}</div>
      {showPassphrase && <PassphrasePrompt onUnlock={handleUnlock} onCancel={() => navigate('/vault')} />}
    </div>
  );

  const isSensitive = snippet.encryption_mode === 'sensitive';
  const isLocked = isSensitive && !decryptedCode;
  const displayCode = isSensitive ? (decryptedCode ?? '••••••••••••••••••\n(unlock to view)') : snippet.code;
  const tags = Array.isArray(snippet.tags) ? snippet.tags.filter(Boolean) : [];

  return (
    <div>
      <Header />
      {showPassphrase && <PassphrasePrompt onUnlock={handleUnlock} onCancel={() => { setShowPassphrase(false); navigate('/vault'); }} />}
      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete snippet?"
          message="This will permanently remove the snippet and all its versions. There's no undo."
          confirmLabel="Delete"
          danger
          onConfirm={doDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {showCopyConfirm && (
        <ConfirmModal
          title="Copy sensitive content?"
          message="The clipboard will be automatically cleared after 45 seconds."
          confirmLabel="Copy"
          onConfirm={doCopy}
          onCancel={() => setShowCopyConfirm(false)}
        />
      )}
      {showShare && snippet && (
        <ShareDialog
          snippet={{ ...snippet, code: decryptedCode || snippet.code }}
          projectId={snippet.project_id}
          senderPrivateKey={sessionStorage.getItem(`unlockKey-${snippet.id}`)}
          onClose={ok => { setShowShare(false); if (ok) toast('Shared successfully', 'success'); }}
        />
      )}

      <div className={styles.page}>
        <div className={styles.topBar}>
          <button className="btn-ghost" onClick={() => navigate('/vault')}>← Vault</button>
          <div className={styles.actions}>
            {clipTimer > 0 && (
              <span className={styles.clipTimer}>🕐 Clipboard clears in {clipTimer}s</span>
            )}
            {isSensitive && isLocked && (
              <button className="btn-ghost" onClick={() => setShowPassphrase(true)}>🔓 Unlock</button>
            )}
            <button className={`btn-ghost ${copied ? styles.copiedBtn : ''}`} onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            {isSensitive && !isLocked && (
              <button className="btn-ghost" onClick={() => setShowShare(true)}>Share</button>
            )}
            <button className="btn-primary" onClick={() => navigate(`/snippet/${id}/edit`)}>Edit</button>
            <button className="btn-danger" onClick={handleDelete}>Delete</button>
          </div>
        </div>

        <div className={styles.layout}>
          <main className={styles.main}>
            <div className={styles.metaRow}>
              <h1 className={styles.title}>
                {isSensitive && <span className={styles.lockIcon}>🔒</span>}
                {snippet.title}
              </h1>
              <div className={styles.badges}>
                {isSensitive && <span className="badge badge-sensitive">🔒 sensitive</span>}
                <span className="badge">{snippet.language}</span>
                <span className={`badge ${snippet.visibility === 'private' ? 'badge-danger' : snippet.visibility === 'project' ? 'badge' : 'badge-ok'}`}>
                  {snippet.visibility}
                </span>
              </div>
            </div>

            {snippet.description && <p className={styles.desc}>{snippet.description}</p>}

            {tags.length > 0 && (
              <div className={styles.tags}>
                {tags.map(t => <span key={t} className={styles.tag}>#{t}</span>)}
              </div>
            )}

            {isSensitive && (
              <div className={styles.encBanner}>
                <span>🔒</span>
                <div>
                  <strong>Zero-knowledge encrypted</strong>
                  <p>This snippet's plaintext is never stored on the server. Only you (and authorized recipients) can decrypt it.</p>
                </div>
              </div>
            )}

            <div className={styles.editorWrap}>
              <Editor
                height="480px"
                language={snippet.language}
                value={displayCode}
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13 }}
              />
            </div>

            <div className={styles.meta}>
              <span>Created {new Date(snippet.created_at).toLocaleString()}</span>
              {snippet.updated_at !== snippet.created_at && <span> · Updated {new Date(snippet.updated_at).toLocaleString()}</span>}
              {snippet.copy_count > 0 && <span> · Copied {snippet.copy_count} time{snippet.copy_count !== 1 ? 's' : ''}</span>}
              {snippet.expires_at && <span> · Expires {new Date(snippet.expires_at).toLocaleString()}</span>}
            </div>

            {aiAction && (
              <StreamResponse
                snippetId={id!}
                action={aiAction}
                model={ollamaModel}
                language={snippet.language}
                targetLanguage={convertLang}
                snippetTitle={snippet.title}
                onClose={() => setAiAction(null)}
                onApplied={(newCode) => {
                  setSnippet(s => (s ? { ...s, code: newCode } : s));
                  setAiAction(null);
                }}
              />
            )}
          </main>

          <aside className={styles.sidebar}>
            {ollamaAvailable && !isSensitive && (
              <div className={`panel ${styles.aiCard}`}>
                <h3 className={styles.aiTitle}>
                  <span className={styles.aiIcon}>✦</span> AI Assistant
                </h3>
                <p className={styles.aiModel}>{ollamaModel}</p>
                <div className={styles.aiActions}>
                  <button className={styles.aiBtn} onClick={() => setAiAction(aiAction === 'explain' ? null : 'explain')}>
                    Explain
                  </button>
                  <button className={styles.aiBtn} onClick={() => setAiAction(aiAction === 'summarize' ? null : 'summarize')}>
                    Summarize
                  </button>
                  <button className={styles.aiBtn} onClick={() => setAiAction(aiAction === 'refactor' ? null : 'refactor')}>
                    Refactor draft
                  </button>
                </div>

                <div className={styles.convertSection}>
                  <p className={styles.convertLabel}>Convert to language</p>
                  <div className={styles.convertRow}>
                    <select
                      className={`select ${styles.convertSelect}`}
                      value={convertLang}
                      onChange={e => setConvertLang(e.target.value)}
                    >
                      {['javascript','typescript','python','rust','go','java','csharp','cpp','bash','swift','kotlin','ruby','php'].filter(l => l !== snippet.language).map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                    <button
                      className={styles.convertBtn}
                      onClick={() => setAiAction(aiAction === 'convert' ? null : 'convert')}
                    >
                      Convert
                    </button>
                  </div>
                </div>

                <p className={styles.aiNote}>Runs locally via Ollama. No cloud.</p>
              </div>
            )}

            {ollamaAvailable && isSensitive && (
              <div className={`panel ${styles.aiCard}`}>
                <h3 className={styles.aiTitle}>✦ AI Assistant</h3>
                <p className={styles.aiNote}>AI is not available for sensitive snippets to protect your privacy.</p>
              </div>
            )}

            {!ollamaAvailable && (
              <div className={`panel ${styles.aiCard}`}>
                <h3 className={styles.aiTitle}>✦ AI Assistant</h3>
                <p className={styles.aiNote}>Ollama not detected. Start Ollama to enable explain, summarize, and refactor actions.</p>
              </div>
            )}

            {isSensitive && (
              <div className={`panel ${styles.infoCard}`}>
                <h3 className={styles.infoTitle}>Security</h3>
                <div className={styles.infoRow}>
                  <span className="badge badge-sensitive">Zero-knowledge</span>
                </div>
                <p className={styles.infoNote}>Encrypted in browser (libsodium sealed box). Server stores ciphertext only. Plaintext never transmitted.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
