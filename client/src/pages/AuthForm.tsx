import { useState, type FormEvent, type ReactNode } from 'react';
import { Archive } from 'lucide-react';
import { errorMessage } from '../lib/errors';
import styles from './Auth.module.css';

interface Props {
  title: string;
  submitLabel: string;
  busyLabel: string;
  passwordHint?: string;
  footer: ReactNode;
  onSubmit: (email: string, password: string) => Promise<void>;
}

export default function AuthForm({ title, submitLabel, busyLabel, passwordHint, footer, onSubmit }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit(email, password);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate={false}>
        <div className={styles.brand}>
          <Archive size={18} strokeWidth={1.75} className={styles.brandIcon} />
          SnippetVault
        </div>
        <h1 className={styles.title}>{title}</h1>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div>
          <label className="field-label" htmlFor="email">Email<span className="required">*</span></label>
          <input id="email" className="input" type="email" autoComplete="email" value={email}
            onChange={e => setEmail(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="field-label" htmlFor="password">Password<span className="required">*</span></label>
          <input id="password" className="input" type="password" value={password}
            autoComplete={passwordHint ? 'new-password' : 'current-password'}
            onChange={e => setPassword(e.target.value)} required minLength={passwordHint ? 8 : undefined}
            aria-describedby={passwordHint ? 'password-hint' : undefined} />
          {passwordHint && <p id="password-hint" className={styles.hint}>{passwordHint}</p>}
        </div>

        <button className={`btn-primary ${styles.submit}`} type="submit" disabled={loading}>
          {loading ? busyLabel : submitLabel}
        </button>
        <p className={styles.footer}>{footer}</p>
      </form>
    </div>
  );
}
