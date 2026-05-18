import { useState, useEffect, type KeyboardEvent } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import Editor from '@monaco-editor/react';
import { ArrowLeft, Lock, TriangleAlert, X } from 'lucide-react';
import { api } from '../lib/api';
import { SEALED_WRAPPED_KEY, decryptSensitive, sealForSelf, sensitiveScheme } from '../lib/crypto';
import { errorMessage } from '../lib/errors';
import { LANGUAGES } from '../lib/languages';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import Header from './Header';
import PassphrasePrompt from './PassphrasePrompt';
import type { Draft, EncryptionMode, Project, Snippet, Visibility } from '../types';
import styles from './SnippetEditor.module.css';

interface FieldErrors {
  title?: string;
  code?: string;
}

export default function SnippetEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { toast } = useToast();
  const isNew = !id || id === 'new';
  const [searchParams] = useSearchParams();
  const draftId = isNew ? searchParams.get('draft') : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [encryptionMode, setEncryptionMode] = useState<EncryptionMode>('standard');
  const [projectId, setProjectId] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [locked, setLocked] = useState<Snippet | null>(null);
  const [legacyPlain, setLegacyPlain] = useState(false);

  useEffect(() => {
    api.get<Project[]>('/projects').then(setProjects).catch(() => {});
    if (isNew && draftId) {
      api.get<Draft>(`/drafts/${draftId}`)
        .then(d => {
          setTitle(d.title);
          setDescription(d.description || '');
          setCode(d.code);
          setLanguage(d.language);
          setTags(d.tags);
        })
        .catch(err => setLoadError(errorMessage(err)));
    }
    if (isNew) return;
    api.get<Snippet>(`/snippets/${id}`)
      .then(s => {
        setTitle(s.title);
        setDescription(s.description || '');
        setCode(s.code);
        setLanguage(s.language);
        setVisibility(s.visibility);
        setEncryptionMode(s.encryption_mode || 'standard');
        setProjectId(s.project_id ? String(s.project_id) : '');
        setTags(s.tags.filter(Boolean));
        if (s.encryption_mode !== 'sensitive') return;
        const scheme = sensitiveScheme(s.wrapped_key);
        if (scheme === 'shared') {
          setLoadError('Shared sensitive snippets cannot be edited. Make a new snippet instead.');
        } else if (scheme === 'plain') {
          setLegacyPlain(true);
        } else {
          setCode('');
          const key = sessionStorage.getItem(`unlockKey-${s.id}`);
          if (key) unlock(s, key);
          else setLocked(s);
        }
      })
      .catch(err => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, isNew, draftId]);

  const unlock = async (s: Snippet, privateKey: string) => {
    const publicKey = localStorage.getItem('encPublicKey');
    try {
      if (!publicKey) throw new Error('no public key');
      setCode(await decryptSensitive(s.code, s.wrapped_key, publicKey, privateKey));
      sessionStorage.setItem(`unlockKey-${s.id}`, privateKey);
      setLocked(null);
    } catch {
      setLocked(null);
      setLoadError('Could not decrypt this snippet with the key on this browser.');
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const handleTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !tagInput && tags.length) setTags(prev => prev.slice(0, -1));
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const result = await api.post<{ title: string; description: string }>('/assistant/suggest', { code, language });
      if (result.title) setTitle(result.title);
      if (result.description) setDescription(result.description);
    } catch {
      toast('Suggest failed. Is Ollama running?', 'error');
    } finally {
      setSuggesting(false);
    }
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!title.trim()) next.title = 'Title is required';
    if (!code.trim()) next.code = 'Code is required';
    setErrors(next);
    return !next.title && !next.code;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const publicKey = localStorage.getItem('encPublicKey');
    if (encryptionMode === 'sensitive' && !publicKey) {
      toast('Set up encryption keys in Settings first', 'error');
      return;
    }
    setSaving(true);
    try {
      const sensitive = encryptionMode === 'sensitive';
      const body = {
        title: title.trim(),
        description: description.trim() || undefined,
        code: sensitive ? await sealForSelf(code, publicKey as string) : code,
        wrapped_key: sensitive ? SEALED_WRAPPED_KEY : undefined,
        language,
        visibility,
        encryption_mode: encryptionMode,
        project_id: projectId ? parseInt(projectId, 10) : undefined,
        expires_at: encryptionMode === 'sensitive' && expiresAt ? new Date(expiresAt).toISOString() : undefined,
      };
      const snippet = isNew
        ? await api.post<Snippet>('/snippets', body)
        : await api.put<Snippet>(`/snippets/${id}`, body);

      if (!isNew) {
        const existing = await api.get<Snippet>(`/snippets/${id}`).then(s => s.tags || []);
        for (const t of existing.filter(t => !tags.includes(t))) {
          await api.del(`/tags/${id}/${t}`).catch(() => {});
        }
      }
      for (const t of tags) {
        await api.post(`/tags/${snippet.id}`, { tag: t }).catch(() => {});
      }
      if (draftId) {
        await api.post(`/drafts/${draftId}/accept`, { snippet_id: snippet.id });
        window.dispatchEvent(new Event('drafts-changed'));
      }
      toast(isNew ? 'Snippet created' : 'Snippet saved', 'success');
      navigate(`/snippet/${snippet.id}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
      setSaving(false);
    }
  };

  const isSensitive = encryptionMode === 'sensitive';
  const back = () => navigate(isNew ? '/vault' : `/snippet/${id}`);

  if (loadError) {
    return (
      <div>
        <Header />
        <div className="page-content">
          <p className={styles.loadError}>Could not load this snippet: {loadError}</p>
          <button className="btn-ghost" onClick={() => navigate('/vault')}>Back to vault</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header />
      {locked && (
        <PassphrasePrompt onUnlock={key => unlock(locked, key)} onCancel={() => navigate(`/snippet/${id}`)} />
      )}
      <div className={styles.page}>
        <div className={styles.topBar}>
          <button className="btn-ghost" onClick={back}>
            <ArrowLeft size={16} strokeWidth={1.75} />
            {isNew ? 'Vault' : 'Back'}
          </button>
          <h1 className={styles.heading}>{draftId ? 'Review draft' : isNew ? 'New snippet' : 'Edit snippet'}</h1>
          <button className="btn-primary" onClick={handleSave} disabled={saving || loading || !!locked}>
            {saving ? 'Saving…' : 'Save snippet'}
          </button>
        </div>

        {loading ? (
          <p className={styles.loading}>Loading snippet…</p>
        ) : (
          <div className={styles.form}>
            <div>
              <label className="field-label" htmlFor="title">Title<span className="required">*</span></label>
              <input id="title" className="input" placeholder="Snippet title" value={title}
                aria-invalid={!!errors.title} aria-describedby={errors.title ? 'title-error' : undefined}
                onChange={e => { setTitle(e.target.value); if (errors.title) setErrors(x => ({ ...x, title: undefined })); }} />
              {errors.title && <p id="title-error" className="field-error">{errors.title}</p>}
            </div>

            <div>
              <label className="field-label" htmlFor="description">Description</label>
              <div className={styles.inline}>
                <input id="description" className="input" placeholder="What is it for (optional)" value={description}
                  onChange={e => setDescription(e.target.value)} />
                <button type="button" className="btn-ghost" onClick={handleSuggest} disabled={suggesting || !code.trim()}
                  title="Ask the local model for a title and description">
                  {suggesting ? 'Suggesting…' : 'Suggest title'}
                </button>
              </div>
            </div>

            <div className={styles.row}>
              <div>
                <label className="field-label" htmlFor="language">Language</label>
                <select id="language" className="select" value={language} onChange={e => setLanguage(e.target.value)}>
                  {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="visibility">Who can see it</label>
                <select id="visibility" className="select" value={visibility} onChange={e => setVisibility(e.target.value as Visibility)}>
                  <option value="private">Only me</option>
                  <option value="project">Project members</option>
                  <option value="shared">Everyone signed in</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="project">Project</label>
                <select id="project" className="select" value={projectId} onChange={e => setProjectId(e.target.value)} disabled={!projects.length}>
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            {legacyPlain && (
              <p className={styles.warning} role="alert">
                <TriangleAlert size={16} strokeWidth={1.75} />
                This snippet was saved before browser encryption worked, so it is stored as plain text.
                Save it once to encrypt it.
              </p>
            )}

            <fieldset className={styles.modes} disabled={!isNew}>
              <legend className="field-label">
                Storage{!isNew && <span className={styles.legendNote}> (can't change after the snippet is created)</span>}
              </legend>
              <label className={styles.mode}>
                <input type="radio" name="mode" checked={!isSensitive} onChange={() => setEncryptionMode('standard')} />
                <span>
                  <strong>Standard</strong>
                  <span className={styles.modeDesc}>Stored as plain text. Searchable and works with the assistant.</span>
                </span>
              </label>
              <label className={`${styles.mode} ${isSensitive ? styles.modeSensitive : ''}`}>
                <input type="radio" name="mode" checked={isSensitive} onChange={() => setEncryptionMode('sensitive')} />
                <span>
                  <strong><Lock size={14} strokeWidth={1.75} /> Sensitive</strong>
                  <span className={styles.modeDesc}>Encrypted in your browser. Not searchable, no assistant.</span>
                </span>
              </label>
            </fieldset>

            {isSensitive && (
              <div className={styles.narrow}>
                <label className="field-label" htmlFor="expires">Expires</label>
                <input id="expires" type="datetime-local" className="input" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </div>
            )}

            <div>
              <label className="field-label" htmlFor="tags">Tags</label>
              <div className={styles.tagBox}>
                {tags.map(t => (
                  <span key={t} className={`badge ${styles.tag}`}>
                    {t}
                    <button type="button" className={styles.tagRemove} onClick={() => removeTag(t)} aria-label={`Remove tag ${t}`}>
                      <X size={12} strokeWidth={2} />
                    </button>
                  </span>
                ))}
                <input id="tags" className={styles.tagInput} placeholder="Add tag, press Enter" value={tagInput}
                  onChange={e => setTagInput(e.target.value)} onKeyDown={handleTagKey} onBlur={addTag} />
              </div>
            </div>

            <div>
              <span className="field-label">Code<span className="required">*</span></span>
              <div className={`${styles.editorWrap} ${errors.code ? styles.editorInvalid : ''}`}>
                <Editor
                  height="420px"
                  language={language}
                  value={code}
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  onChange={val => { setCode(val || ''); if (errors.code) setErrors(x => ({ ...x, code: undefined })); }}
                  options={{ minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', lineNumbersMinChars: 3 }}
                />
              </div>
              {errors.code && <p className="field-error">{errors.code}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
