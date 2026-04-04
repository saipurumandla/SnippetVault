import { useState, type FormEvent } from 'react';
import { useToast } from '../context/ToastContext';
import Header from '../components/Header';
import { Download, Upload } from 'lucide-react';
import styles from './BackupRestore.module.css';
import { errorMessage } from '../lib/errors';

export default function BackupRestore() {
  const [passphrase, setPassphrase] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleExport = async (e: FormEvent) => {
    e.preventDefault();
    if (!passphrase) { toast('Enter a passphrase', 'error'); return; }
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
    if (!passphrase || !restoreFile) { toast('Pick a file and enter the passphrase', 'error'); return; }
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
          <h1 className="page-title">Backup and restore</h1>
        </div>
        <p className={styles.intro}>
          A backup is one .enc file, encrypted with AES-256-GCM using a key made from your passphrase.
          Only standard snippets go in it. Sensitive snippets stay in the vault.
        </p>

        <section className={styles.section}>
          <div>
            <h2 className={styles.sectionTitle}>Download a backup</h2>
            <p className={styles.sectionDesc}>You need the same passphrase to restore it.</p>
          </div>
          <form onSubmit={handleExport} className={styles.form}>
            <div>
              <label className="field-label" htmlFor="export-pass">Passphrase<span className="required">*</span></label>
              <input id="export-pass" className="input" type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} required />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              <Download size={16} strokeWidth={1.75} />
              {loading ? 'Preparing…' : 'Download backup'}
            </button>
          </form>
        </section>

        <section className={styles.section}>
          <div>
            <h2 className={styles.sectionTitle}>Restore from a file</h2>
            <p className={styles.sectionDesc}>Snippets that already exist are skipped, nothing is overwritten.</p>
          </div>
          <form onSubmit={handleRestore} className={styles.form}>
            <div>
              <label className="field-label" htmlFor="restore-file">Backup file<span className="required">*</span></label>
              <input id="restore-file" type="file" accept=".enc" className={styles.file} onChange={e => setRestoreFile(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <label className="field-label" htmlFor="restore-pass">Passphrase<span className="required">*</span></label>
              <input id="restore-pass" className="input" type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} required />
            </div>
            <button className="btn-ghost" type="submit" disabled={loading}>
              <Upload size={16} strokeWidth={1.75} />
              {loading ? 'Restoring…' : 'Restore'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
