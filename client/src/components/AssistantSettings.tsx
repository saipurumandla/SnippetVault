import { useEffect, useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { CLOUD } from '../lib/providers';
import { useToast } from '../context/ToastContext';
import type { AiSettings, CloudProvider, ProviderChoice } from '../types';
import styles from './AssistantSettings.module.css';

function KeyForm({ id, label, saved, canStore, onSaved }: {
  id: CloudProvider; label: string; saved?: AiSettings['keys'][number]; canStore: boolean; onSaved: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(saved?.model ?? '');
  const [models, setModels] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!saved && !apiKey.trim()) { setError('API key is required'); return; }
    if (!model.trim()) { setError('Model is required'); return; }
    setBusy(true);
    setError('');
    try {
      await api.put(`/ai/keys/${id}`, { apiKey: apiKey.trim() || undefined, model: model.trim() });
      setApiKey('');
      toast(`${label} saved`, 'success');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const loadModels = async () => {
    try {
      setModels(await api.get<string[]>(`/ai/models/${id}`));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async () => {
    await api.del(`/ai/keys/${id}`);
    toast(`${label} key removed`, 'success');
    onSaved();
  };

  return (
    <form className={styles.keyForm} onSubmit={save} aria-label={`${label} key`}>
      <div className={styles.keyHead}>
        <strong>{label}</strong>
        {saved && <span className={styles.muted}>key ending {saved.last4}</span>}
      </div>
      <label className={styles.field}>
        <span>API key</span>
        <input className="input" type="password" autoComplete="off" disabled={!canStore}
          placeholder={saved ? 'leave empty to keep the saved key' : 'paste your key'}
          value={apiKey} onChange={e => setApiKey(e.target.value)} />
      </label>
      <label className={styles.field}>
        <span>Model</span>
        <input className="input" list={`${id}-models`} placeholder="model id from your provider"
          value={model} onChange={e => setModel(e.target.value)} />
        <datalist id={`${id}-models`}>{models.map(m => <option key={m} value={m} />)}</datalist>
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="submit" className="btn-ghost" disabled={busy || !canStore}>Save {label}</button>
        {saved && <button type="button" className="btn-ghost" onClick={loadModels}>Load models</button>}
        {saved && <button type="button" className="btn-danger" onClick={remove}>Remove key</button>}
      </div>
    </form>
  );
}

export default function AssistantSettings() {
  const [s, setS] = useState<AiSettings | null>(null);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const load = () => api.get<AiSettings>('/ai').then(setS).catch(err => setError(errorMessage(err)));
  useEffect(() => { load(); }, []);

  if (error) return <p className={styles.error} role="alert">{error}</p>;
  if (!s) return <p className={styles.muted}>Loading…</p>;

  const pick = async (provider: ProviderChoice) => {
    try {
      await api.put('/ai/provider', { provider });
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const togglePersonal = async (provider: CloudProvider, allow: boolean) => {
    await api.put('/ai/consent', { provider, projectId: null, allow });
    load();
  };

  const hasKey = (id: CloudProvider) => s.keys.some(k => k.provider === id);

  return (
    <div className={styles.wrap}>
      <fieldset className={styles.choices}>
        <legend className="sr-only">Assistant model</legend>
        <label className={styles.choice}>
          <input type="radio" name="provider" checked={s.provider === 'ollama'} onChange={() => pick('ollama')} />
          <span>
            <strong>Local, Ollama</strong>
            <span className={styles.muted}>
              {s.localModels.length ? `${s.localModels.length} installed: ${s.localModels.join(', ')}` : 'Ollama is not reachable'}
            </span>
          </span>
        </label>
        {CLOUD.map(c => (
          <label key={c.id} className={styles.choice}>
            <input type="radio" name="provider" checked={s.provider === c.id} disabled={!hasKey(c.id)} onChange={() => pick(c.id)} />
            <span>
              <strong>{c.label}</strong>
              <span className={styles.muted}>{hasKey(c.id) ? `your key, ${s.keys.find(k => k.provider === c.id)!.model}` : 'add a key below first'}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <p className={styles.note}>
        <Lock size={14} strokeWidth={1.75} aria-hidden />
        Sensitive snippets never go to a cloud model, whatever you pick here.
      </p>

      {!s.canStoreKeys && (
        <p className={styles.warn}>Set <code>MASTER_KEY</code> in <code>.env</code> to save API keys. Without it keys would be lost on restart.</p>
      )}

      <div className={styles.keys}>
        {CLOUD.map(c => (
          <KeyForm key={c.id} id={c.id} label={c.label} saved={s.keys.find(k => k.provider === c.id)} canStore={s.canStoreKeys} onSaved={load} />
        ))}
      </div>

      <fieldset className={styles.consent}>
        <legend>Your personal snippets may go to</legend>
        {CLOUD.map(c => (
          <label key={c.id} className={styles.check}>
            <input type="checkbox" checked={s.personalConsent.includes(c.id)} onChange={e => togglePersonal(c.id, e.target.checked)} />
            {c.label}
          </label>
        ))}
        <p className={styles.muted}>Project snippets need the project owner to allow it, on the Projects page.</p>
      </fieldset>
    </div>
  );
}
