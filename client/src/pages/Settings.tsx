import { useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import EncryptionSetup from '../components/EncryptionSetup';
import Header from '../components/Header';
import styles from './Settings.module.css';

export default function Settings() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [showEncSetup, setShowEncSetup] = useState(false);
  const hasKeys = !!localStorage.getItem('encPublicKey');

  return (
    <div>
      <Header />
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Settings</h1>
        </div>

        <div className={styles.grid}>
          <div className={`panel ${styles.section}`}>
            <h2 className={styles.sectionTitle}>Encryption keys</h2>
            <p className={styles.sectionDesc}>
              Sensitive snippets use client-side encryption. Your private key never leaves your browser.
            </p>
            <div className={styles.keyStatus}>
              {hasKeys ? (
                <span className="badge">🔒 Keypair active</span>
              ) : (
                <span className="badge badge-sensitive">⚠ No keypair — sensitive mode unavailable</span>
              )}
            </div>
            <button
              className="btn-primary"
              style={{ marginTop: 14 }}
              onClick={() => setShowEncSetup(true)}
            >
              {hasKeys ? 'Regenerate keypair' : 'Set up encryption'}
            </button>
            {showEncSetup && <EncryptionSetup onDone={() => { setShowEncSetup(false); toast('Keypair ready', 'success'); window.location.reload(); }} />}
          </div>

          <div className={`panel ${styles.section}`}>
            <h2 className={styles.sectionTitle}>Session</h2>
            <p className={styles.sectionDesc}>
              Unlock sessions for sensitive snippets expire after 15 minutes of inactivity.
              Signing out clears all in-memory keys immediately.
            </p>
            <button className="btn-danger" style={{ marginTop: 14 }} onClick={() => { logout(); window.location.href = '/login'; }}>
              Sign out
            </button>
          </div>

          <div className={`panel ${styles.section}`}>
            <h2 className={styles.sectionTitle}>AI assistant</h2>
            <p className={styles.sectionDesc}>
              The local Ollama assistant uses <strong>qwen3-coder:30b</strong> by default.
              Change the model in <code>.env</code> via <code>OLLAMA_DEFAULT_MODEL</code>.
            </p>
            <button className="btn-ghost" style={{ marginTop: 14 }} onClick={() =>
              api.get<{ available: boolean; models: string[] }>('/assistant/models')
                .then(d => toast(d.available ? `Ollama ready — ${d.models.length} models` : 'Ollama not reachable', d.available ? 'success' : 'warning'))
                .catch(() => toast('Could not check Ollama', 'error'))
            }>
              Check Ollama status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
