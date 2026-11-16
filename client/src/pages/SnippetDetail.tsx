import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import Editor from '@monaco-editor/react';
import { api } from '../lib/api';
import { decryptSensitive, sensitiveScheme } from '../lib/crypto';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import PassphrasePrompt from '../components/PassphrasePrompt';
import ShareDialog from '../components/ShareDialog';
import StreamResponse from '../components/StreamResponse';
import ConfirmModal from '../components/ConfirmModal';
import Header from '../components/Header';
import { ArrowLeft, Check, Clock, Copy, Lock, LockOpen, Pencil, Share2, Trash2 } from 'lucide-react';
import { languageLabel } from '../lib/languages';
import { longDate } from '../lib/dates';
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
  const [loadError, setLoadError] = useState('');
  const [active, setActive] = useState<{ provider: string; model: string } | null>(null);
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
        if (s.encryption_mode === 'sensitive' && sensitiveScheme(s.wrapped_key) === 'plain') {
          setDecryptedCode(s.code);
        } else if (s.encryption_mode === 'sensitive') {
          const key = sessionStorage.getItem(`unlockKey-${s.id}`);
          if (key) performDecrypt(s, key);
          else setShowPassphrase(true);
        }
      })
      .catch(err => setLoadError(errorMessage(err)));

    api.get<{ available: boolean; active: { provider: string; model: string } }>('/assistant/models').then(d => {
      setOllamaAvailable(d.available);
      setActive(d.active);
    }).catch(() => {});

    return () => { clearTimeout(unlockTimer.current); clearInterval(clipInterval.current); };
  }, [id]);

  const performDecrypt = async (s: Snippet, privateKey: string) => {
    try {
      const publicKey = localStorage.getItem('encPublicKey');
      if (!publicKey) throw new Error('no public key on this browser');
      const plain = await decryptSensitive(s.code, s.wrapped_key, publicKey, privateKey);
      setDecryptedCode(plain);
      sessionStorage.setItem(`unlockKey-${s.id}`, privateKey);
      clearTimeout(unlockTimer.current);
      unlockTimer.current = setTimeout(() => { setDecryptedCode(null); sessionStorage.removeItem(`unlockKey-${s.id}`); }, UNLOCK_TTL);
    } catch { toast('Could not decrypt. Wrong key or damaged data.', 'error'); }
  };

  const handleUnlock = async (privateKey: string) => {
    setShowPassphrase(false);
    if (snippet) await performDecrypt(snippet, privateKey);
  };

  const handleCopy = async () => {
    const code = displayCode;
    if (!code) { toast('Unlock the snippet first', 'warning'); return; }

    if (isSensitive && !showCopyConfirm) {
      setShowCopyConfirm(true);
      return;
    }

    await navigator.clipboard.writeText(code);
    api.post(`/snippets/${id}/copy`, {}).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast('Code copied', 'success');

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
      <div className="page-content">
        {loadError ? (
          <>
            <p className={styles.note}>Could not load this snippet: {loadError}</p>
            <button className="btn-ghost" onClick={() => navigate('/vault')}>Back to vault</button>
          </>
        ) : (
          !showPassphrase && <p className={styles.note}>Loading snippet…</p>
        )}
      </div>
      {showPassphrase && <PassphrasePrompt onUnlock={handleUnlock} onCancel={() => navigate('/vault')} />}
    </div>
  );

  const isSensitive = snippet.encryption_mode === 'sensitive';
  const isLocked = isSensitive && !decryptedCode;
  const displayCode = isSensitive ? (decryptedCode ?? '') : snippet.code;
  const tags = snippet.tags.filter(Boolean);
  const convertTargets = ['javascript', 'typescript', 'python', 'rust', 'go', 'java', 'csharp', 'cpp', 'bash', 'swift', 'kotlin', 'ruby', 'php']
    .filter(l => l !== snippet.language);
  const toggleAction = (a: AiAction) => setAiAction(cur => (cur === a ? null : a));

  return (
    <div>
      <Header />
      {showPassphrase && <PassphrasePrompt onUnlock={handleUnlock} onCancel={() => { setShowPassphrase(false); navigate('/vault'); }} />}
      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete this snippet?"
          message="The snippet and all its versions are removed. This can't be undone."
          confirmLabel="Delete snippet"
          danger
          onConfirm={doDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {showCopyConfirm && (
        <ConfirmModal
          title="Copy sensitive code?"
          message="The clipboard is cleared again after 45 seconds."
          confirmLabel="Copy code"
          onConfirm={doCopy}
          onCancel={() => setShowCopyConfirm(false)}
        />
      )}
      {showShare && (
        <ShareDialog
          snippet={{ ...snippet, code: decryptedCode || snippet.code }}
          projectId={snippet.project_id}
          senderPrivateKey={sessionStorage.getItem(`unlockKey-${snippet.id}`)}
          onClose={ok => { setShowShare(false); if (ok) toast('Snippet shared', 'success'); }}
        />
      )}

      <div className={styles.page}>
        <div className={styles.topBar}>
          <button className="btn-ghost" onClick={() => navigate('/vault')}>
            <ArrowLeft size={16} strokeWidth={1.75} />
            Vault
          </button>
          <div className={styles.actions}>
            {clipTimer > 0 && (
              <span className={styles.clipTimer}>
                <Clock size={14} strokeWidth={1.75} />
                Clipboard clears in {clipTimer}s
              </span>
            )}
            {isLocked && (
              <button className="btn-ghost" onClick={() => setShowPassphrase(true)}>
                <LockOpen size={16} strokeWidth={1.75} />
                Unlock
              </button>
            )}
            {!isLocked && (
              <button className="btn-ghost" onClick={handleCopy}>
                {copied ? <Check size={16} strokeWidth={1.75} /> : <Copy size={16} strokeWidth={1.75} />}
                Copy code
              </button>
            )}
            {isSensitive && !isLocked && (
              <button className="btn-ghost" onClick={() => setShowShare(true)}>
                <Share2 size={16} strokeWidth={1.75} />
                Share
              </button>
            )}
            <button className="btn-ghost" onClick={() => navigate(`/snippet/${id}/edit`)}>
              <Pencil size={16} strokeWidth={1.75} />
              Edit
            </button>
            <button className="btn-danger" onClick={handleDelete}>
              <Trash2 size={16} strokeWidth={1.75} />
              Delete
            </button>
          </div>
        </div>

        <div className={styles.layout}>
          <main className={styles.main}>
            <h1 className={styles.title}>
              {isSensitive && <Lock size={18} strokeWidth={1.75} className={styles.lock} aria-label="Sensitive" />}
              {snippet.title}
            </h1>
            <p className={styles.meta}>
              {languageLabel(snippet.language)} · {snippet.visibility}
              {isSensitive && <> · <span className={styles.sensitiveText}>sensitive</span></>}
            </p>
            {snippet.description && <p className={styles.desc}>{snippet.description}</p>}
            {tags.length > 0 && (
              <div className={styles.tags}>
                {tags.map(t => <span key={t} className="badge">{t}</span>)}
              </div>
            )}

            {isSensitive && sensitiveScheme(snippet.wrapped_key) === 'plain' && (
              <p className={styles.legacy} role="alert">
                This snippet was saved before browser encryption worked, so it is stored as plain text on the server.
                {' '}<a href={`/snippet/${snippet.id}/edit`}>Open it in the editor</a> and save once to encrypt it.
              </p>
            )}

            {isLocked ? (
              <div className={styles.locked}>
                <Lock size={16} strokeWidth={1.75} />
                <span>This snippet is encrypted in your browser. Unlock it with your passphrase to see the code.</span>
              </div>
            ) : (
              <div className={styles.editorWrap}>
                <Editor
                  height="480px"
                  language={snippet.language}
                  value={displayCode}
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, fontFamily: 'IBM Plex Mono, monospace' }}
                />
              </div>
            )}

            <p className={styles.footMeta}>
              Created {longDate(snippet.created_at)}
              {snippet.updated_at !== snippet.created_at && <> · updated {longDate(snippet.updated_at)}</>}
              {snippet.copy_count > 0 && <> · copied {snippet.copy_count}×</>}
              {snippet.expires_at && <> · expires {longDate(snippet.expires_at)}</>}
            </p>

            {aiAction && (
              <StreamResponse
                snippetId={id!}
                action={aiAction}
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
            <section className={styles.side}>
              <h2 className={styles.sideTitle}>Assistant</h2>
              {isSensitive ? (
                <p className={styles.sideNote}>Not available for sensitive snippets. Their code never leaves your browser.</p>
              ) : !ollamaAvailable ? (
                <p className={styles.sideNote}>
                  {active?.provider === 'ollama' ? `Ollama is not running or ${active.model} is not installed. Start it, or pick another model in Settings.` : 'The assistant model is not set up. See Settings.'}
                </p>
              ) : (
                <>
                  <p className={styles.sideNote}>
                    {active?.provider === 'ollama' ? `Runs on ${active.model}, on this machine.` : `Runs on ${active?.provider} (${active?.model}) with your key.`}
                  </p>
                  <div className={styles.sideActions}>
                    <button className="btn-ghost" aria-pressed={aiAction === 'explain'} onClick={() => toggleAction('explain')}>Explain</button>
                    <button className="btn-ghost" aria-pressed={aiAction === 'summarize'} onClick={() => toggleAction('summarize')}>Summarize</button>
                    <button className="btn-ghost" aria-pressed={aiAction === 'refactor'} onClick={() => toggleAction('refactor')}>Draft a refactor</button>
                  </div>
                  <label className="field-label" htmlFor="convert-to">Convert to</label>
                  <div className={styles.convertRow}>
                    <select id="convert-to" className="select" value={convertLang} onChange={e => setConvertLang(e.target.value)}>
                      {convertTargets.map(l => <option key={l} value={l}>{languageLabel(l)}</option>)}
                    </select>
                    <button className="btn-ghost" onClick={() => toggleAction('convert')}>Convert</button>
                  </div>
                </>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
