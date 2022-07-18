import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { api } from '../lib/api';
import { decryptFromSender } from '../lib/crypto';
import PassphrasePrompt from '../components/PassphrasePrompt';
import styles from './SnippetDetail.module.css';

const UNLOCK_TTL = 15 * 60 * 1000;

export default function SnippetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [snippet, setSnippet] = useState(null);
  const [error, setError] = useState('');
  const [decryptedCode, setDecryptedCode] = useState(null);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const unlockTimer = useRef(null);
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';

  useEffect(() => {
    api.get(`/snippets/${id}`)
      .then(s => {
        setSnippet(s);
        if (s.encryption_mode === 'sensitive') {
          const sessionKey = sessionStorage.getItem(`unlockKey-${s.id}`);
          if (sessionKey) {
            performDecrypt(s, sessionKey);
          } else {
            setShowPassphrase(true);
          }
        }
      })
      .catch(err => setError(err.message));
    return () => clearTimeout(unlockTimer.current);
  }, [id]);

  const performDecrypt = async (s, privateKey) => {
    try {
      const payload = s.wrapped_key ? JSON.parse(s.wrapped_key) : {};
      const senderPub = localStorage.getItem('encPublicKey');
      const plain = await decryptFromSender(
        { ciphertext: s.code, nonce: payload.nonce },
        senderPub,
        privateKey
      );
      setDecryptedCode(plain);
      sessionStorage.setItem(`unlockKey-${s.id}`, privateKey);
      clearTimeout(unlockTimer.current);
      unlockTimer.current = setTimeout(() => {
        setDecryptedCode(null);
        sessionStorage.removeItem(`unlockKey-${s.id}`);
      }, UNLOCK_TTL);
    } catch {
      setError('Failed to decrypt. Wrong key or corrupted data.');
    }
  };

  const handleUnlock = async (privateKey) => {
    setShowPassphrase(false);
    if (snippet) await performDecrypt(snippet, privateKey);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this snippet?')) return;
    try {
      await api.del(`/snippets/${id}`);
      navigate('/vault');
    } catch (err) {
      setError(err.message);
    }
  };

  if (error) return <div className={styles.page}><p className={styles.error}>{error}</p></div>;
  if (!snippet) return <div className={styles.page}><p className={styles.muted}>Loading…</p></div>;

  const displayCode = snippet.encryption_mode === 'sensitive'
    ? (decryptedCode ?? '[locked — unlock to view]')
    : snippet.code;

  return (
    <div className={styles.page}>
      {showPassphrase && (
        <PassphrasePrompt onUnlock={handleUnlock} onCancel={() => { setShowPassphrase(false); navigate('/vault'); }} />
      )}
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate('/vault')}>← Back</button>
        <div className={styles.actions}>
          <button className={styles.editBtn} onClick={() => navigate(`/snippet/${id}/edit`)}>Edit</button>
          <button className={styles.delBtn} onClick={handleDelete}>Delete</button>
        </div>
      </div>
      <h1 className={styles.title}>{snippet.title}</h1>
      {snippet.description && <p className={styles.desc}>{snippet.description}</p>}
      <div className={styles.meta}>
        <span className={styles.lang}>{snippet.language}</span>
        <span className={styles.date}>{new Date(snippet.updated_at).toLocaleDateString()}</span>
      </div>
      <div className={styles.editor}>
        <Editor
          height="400px"
          language={snippet.language}
          value={displayCode}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13 }}
        />
      </div>
    </div>
  );
}
