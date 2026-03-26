import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import styles from './Auth.module.css';
import { errorMessage } from '../lib/errors';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await api.post<{ token: string }>('/auth/login', { email, password });
      login(token);
      navigate('/vault');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <span className={styles.logo}>⬡</span>
          <h1 className={styles.title}>SnippetVault</h1>
          <p className={styles.sub}>Self-hosted team snippet manager</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '10px' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className={styles.link}>No account? <Link to="/register">Register</Link></p>

        <div className={styles.badges}>
          <span className="badge">🔒 AES-256-GCM</span>
          <span className="badge">🔑 Zero-knowledge</span>
          <span className="badge">🏠 Self-hosted</span>
        </div>
      </div>
    </div>
  );
}
