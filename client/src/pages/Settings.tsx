import { useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import EncryptionSetup from '../components/EncryptionSetup';
import Header from '../components/Header';
import styles from './Settings.module.css';

export default function Settings() {
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const [showEncSetup, setShowEncSetup] = useState(false);
  const [checking, setChecking] = useState(false);
  const hasKeys = !!localStorage.getItem('encPublicKey');

  const checkOllama = async () => {
    setChecking(true);
    try {
      const d = await api.get<{ available: boolean; models: string[] }>('/assistant/models');
      toast(d.available ? `Ollama is running, ${d.models.length} models allowed` : 'Ollama is not reachable', d.available ? 'success' : 'warning');
    } catch {
      toast('Could not check Ollama', 'error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div>
      <Header />
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Settings</h1>
        </div>

        <section className={styles.section}>
          <div>
            <h2 className={styles.sectionTitle}>Encryption keys</h2>
            <p className={styles.sectionDesc}>
              Sensitive snippets are encrypted in your browser. Your private key is protected by your
              passphrase and never leaves this browser.
            </p>
          </div>
          <div className={styles.controls}>
            {hasKeys ? (
              <span className="badge badge-ok"><Check size={12} strokeWidth={2} /> Keypair set up</span>
            ) : (
              <span className="badge">No keypair yet</span>
            )}
            <button className={hasKeys ? 'btn-ghost' : 'btn-primary'} onClick={() => setShowEncSetup(true)}>
              {hasKeys ? 'Create new keypair' : 'Set up encryption'}
            </button>
          </div>
          {showEncSetup && (
            <EncryptionSetup onDone={() => { setShowEncSetup(false); toast('Keypair ready', 'success'); window.location.reload(); }} />
          )}
        </section>

        <section className={styles.section}>
          <div>
            <h2 className={styles.sectionTitle}>Theme</h2>
            <p className={styles.sectionDesc}>Follows your system setting until you pick one here.</p>
          </div>
          <div className={styles.controls}>
            <button className="btn-ghost" onClick={toggle}>
              Use {theme === 'dark' ? 'light' : 'dark'} theme
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <div>
            <h2 className={styles.sectionTitle}>Assistant</h2>
            <p className={styles.sectionDesc}>
              Runs on your own Ollama, default model <code>qwen3-coder:30b</code>.
              Change it with <code>OLLAMA_DEFAULT_MODEL</code> in <code>.env</code>.
            </p>
          </div>
          <div className={styles.controls}>
            <button className="btn-ghost" onClick={checkOllama} disabled={checking}>
              {checking ? 'Checking…' : 'Check Ollama'}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <div>
            <h2 className={styles.sectionTitle}>Session</h2>
            <p className={styles.sectionDesc}>
              Unlocked sensitive snippets lock again after 15 minutes. Signing out clears all keys from memory.
            </p>
          </div>
          <div className={styles.controls}>
            <button className="btn-danger" onClick={() => { logout(); window.location.href = '/login'; }}>Sign out</button>
          </div>
        </section>
      </div>
    </div>
  );
}
