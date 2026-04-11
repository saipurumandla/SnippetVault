import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { shortDate } from '../lib/dates';
import { useToast } from '../context/ToastContext';
import Header from '../components/Header';
import ConfirmModal from '../components/ConfirmModal';
import type { AccessToken, TokenScope } from '../types';
import table from './Table.module.css';
import styles from './Tokens.module.css';

const SCOPE_INFO: Record<TokenScope, string> = {
  read: 'Search and read your snippets (never sensitive ones)',
  propose: 'Suggest new snippets. They wait in Drafts until you accept them',
};

export default function Tokens() {
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<TokenScope[]>(['read']);
  const [formError, setFormError] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<AccessToken | null>(null);
  const { toast } = useToast();

  const load = () => {
    setLoadError('');
    api.get<AccessToken[]>('/tokens')
      .then(setTokens)
      .catch(err => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const toggleScope = (s: TokenScope) =>
    setScopes(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setFormError('Name is required'); return; }
    if (!scopes.length) { setFormError('Pick at least one scope'); return; }
    try {
      const res = await api.post<AccessToken & { token: string }>('/tokens', { name: name.trim(), scopes });
      setCreated(res.token);
      setCopied(false);
      setShowCreate(false);
      setName('');
      setScopes(['read']);
      load();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const copyToken = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created);
    setCopied(true);
  };

  const doRevoke = async () => {
    const t = confirmRevoke;
    setConfirmRevoke(null);
    if (!t) return;
    try {
      await api.del(`/tokens/${t.id}`);
      toast(`${t.name} revoked`, 'success');
      load();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <div>
      <Header />
      {confirmRevoke && (
        <ConfirmModal
          title={`Revoke ${confirmRevoke.name}?`}
          message="Anything using this token stops working right away."
          confirmLabel="Revoke token"
          danger
          onConfirm={doRevoke}
          onCancel={() => setConfirmRevoke(null)}
        />
      )}
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Access tokens</h1>
          {!showCreate && (
            <button className="btn-primary" onClick={() => { setShowCreate(true); setFormError(''); }}>
              <Plus size={16} strokeWidth={1.75} />
              New token
            </button>
          )}
        </div>
        <p className={table.intro}>
          Tokens let AI agents and editors (Cursor, VS Code and other MCP clients) use your vault over MCP. See <a href="/docs">Docs</a> for setup.
        </p>

        {created && (
          <div className={styles.created} role="status">
            <p className={styles.createdTitle}>Copy this token now. You won't see it again.</p>
            <div className={styles.tokenRow}>
              <code className={styles.token}>{created}</code>
              <button className="btn-ghost" onClick={copyToken}>
                {copied ? <Check size={16} strokeWidth={1.75} /> : <Copy size={16} strokeWidth={1.75} />}
                {copied ? 'Copied' : 'Copy token'}
              </button>
              <button className="btn-ghost" onClick={() => setCreated(null)}>Done</button>
            </div>
          </div>
        )}

        {showCreate && (
          <form className={styles.form} onSubmit={handleCreate}>
            <div>
              <label className="field-label" htmlFor="token-name">Name<span className="required">*</span></label>
              <input id="token-name" className="input" placeholder="work laptop" value={name} autoFocus
                aria-invalid={!!formError && !name.trim()} onChange={e => { setName(e.target.value); setFormError(''); }} />
            </div>
            <fieldset className={styles.scopes}>
              <legend className="field-label">Scopes</legend>
              {(Object.keys(SCOPE_INFO) as TokenScope[]).map(s => (
                <label key={s} className={styles.scope}>
                  <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} />
                  <span><strong>{s}</strong> <span className={styles.scopeDesc}>{SCOPE_INFO[s]}</span></span>
                </label>
              ))}
            </fieldset>
            {formError && <p className="field-error">{formError}</p>}
            <div className={styles.actions}>
              <button type="submit" className="btn-primary">Create token</button>
              <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <p className={table.note}>Loading tokens…</p>
        ) : loadError ? (
          <div className={table.note}>
            <p>Could not load tokens: {loadError}</p>
            <button className="btn-ghost" onClick={load}>Try again</button>
          </div>
        ) : tokens.length === 0 ? (
          <p className={table.note}>No tokens yet.</p>
        ) : (
          <table className={table.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Token</th>
                <th>Scopes</th>
                <th>Created</th>
                <th>Last used</th>
                <th className={table.right}>Status</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map(t => (
                <tr key={t.id}>
                  <td className={table.strong}>{t.name}</td>
                  <td className={table.mono}>{t.prefix}…</td>
                  <td className={table.muted}>{t.scopes.join(', ')}</td>
                  <td className={table.muted}>{shortDate(t.created_at)}</td>
                  <td className={table.muted}>{t.last_used_at ? shortDate(t.last_used_at) : 'never'}</td>
                  <td className={table.right}>
                    {t.revoked_at ? (
                      <span className="badge">revoked</span>
                    ) : (
                      <button className="btn-danger" onClick={() => setConfirmRevoke(t)}>Revoke</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
