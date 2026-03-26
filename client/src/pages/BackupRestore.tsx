import { useState, type FormEvent } from 'react';
import { useToast } from '../context/ToastContext';
import Header from '../components/Header';
import styles from './BackupRestore.module.css';
import { errorMessage } from '../lib/errors';

export default function BackupRestore() {
  const [passphrase, setPassphrase] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleExport = async (e: FormEvent) => {
    e.preventDefault();
    if (!passphrase) { toast('Passphrase required', 'error'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/backup/export?passphrase=${encodeURIComponent(passphrase)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'vault-backup.enc'; a.click();
      URL.revokeObjectURL(url);
      toast('Backup downloaded', 'success');
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setLoading(false); }
  };

  const handleRestore = async (e: FormEvent) => {
    e.preventDefault();
    if (!passphrase || !restoreFile) { toast('Passphrase and file required', 'error'); return; }
    setLoading(true);
    try {
      const text = await restoreFile.text();
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/backup/restore?passphrase=${encodeURIComponent(passphrase)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Restored ${data.imported} snippets`, 'success');
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setLoading(false); }
  };

  return (
    <div>
      <Header />
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Backup & Restore</h1>
        </div>

        <div className={styles.notice}>
          <span className="badge">🔒 Encrypted</span>
          <p>Backups are AES-256-GCM encrypted with your passphrase before download. Only standard (non-sensitive) snippets are exported. The server never sees your passphrase.</p>
        </div>

        <div className={styles.grid}>
          <div className={`panel ${styles.section}`}>
            <h2 className={styles.sectionTitle}>Export backup</h2>
            <p className={styles.sectionDesc}>Download an encrypted backup of your vault.</p>
            <form onSubmit={handleExport} className={styles.form}>
              <input className="input" type="password" placeholder="Encryption passphrase" value={passphrase} onChange={e => setPassphrase(e.target.value)} required />
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Exporting…' : '⬇ Download backup'}
              </button>
            </form>
          </div>

          <div className={`panel ${styles.section}`}>
            <h2 className={styles.sectionTitle}>Restore backup</h2>
            <p className={styles.sectionDesc}>Restore snippets from an encrypted backup file.</p>
            <form onSubmit={handleRestore} className={styles.form}>
              <input className="input" type="password" placeholder="Decryption passphrase" value={passphrase} onChange={e => setPassphrase(e.target.value)} required />
              <input type="file" accept=".enc" onChange={e => setRestoreFile(e.target.files?.[0] ?? null)} className={styles.fileInput} />
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Restoring…' : '⬆ Restore'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
