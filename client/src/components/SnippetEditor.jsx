import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import Editor from '@monaco-editor/react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import Header from './Header';
import styles from './SnippetEditor.module.css';

const LANGUAGES = ['javascript','typescript','python','bash','sql','json','yaml','html','css','go','rust','java','csharp','cpp','markdown','plaintext'];

export default function SnippetEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { toast } = useToast();
  const isNew = !id || id === 'new';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [visibility, setVisibility] = useState('private');
  const [encryptionMode, setEncryptionMode] = useState('standard');
  const [projectId, setProjectId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [projects, setProjects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    api.get('/projects').then(setProjects).catch(() => {});
    if (!isNew) {
      api.get(`/snippets/${id}`)
        .then(s => {
          setTitle(s.title);
          setDescription(s.description || '');
          setCode(s.code);
          setLanguage(s.language);
          setVisibility(s.visibility);
          setEncryptionMode(s.encryption_mode || 'standard');
          setProjectId(s.project_id || '');
          setTags(Array.isArray(s.tags) ? s.tags.filter(Boolean) : []);
        })
        .catch(err => toast(err.message, 'error'));
    }
  }, [id, isNew]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (t) => setTags(prev => prev.filter(x => x !== t));

  const handleTagKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags(prev => prev.slice(0, -1));
    }
  };

  const handleSuggest = async () => {
    if (!code.trim()) { toast('Write some code first', 'warning'); return; }
    setSuggesting(true);
    try {
      const result = await api.post('/assistant/suggest', { code, language });
      if (result.title) setTitle(result.title);
      if (result.description) setDescription(result.description);
      toast('Title and description updated', 'success');
    } catch (err) {
      toast('AI suggest failed — is Ollama running?', 'error');
    } finally {
      setSuggesting(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { toast('Title is required', 'error'); return; }
    if (!code.trim()) { toast('Code is required', 'error'); return; }
    if (encryptionMode === 'sensitive' && !localStorage.getItem('encPublicKey')) {
      toast('Set up encryption keys in Settings first', 'error'); return;
    }
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || undefined,
        code,
        language,
        visibility,
        encryption_mode: encryptionMode,
        project_id: projectId ? parseInt(projectId) : undefined,
        expires_at: (encryptionMode === 'sensitive' && expiresAt) ? new Date(expiresAt).toISOString() : undefined,
      };

      let snippet;
      if (isNew) {
        snippet = await api.post('/snippets', body);
      } else {
        snippet = await api.put(`/snippets/${id}`, body);
      }

      // sync tags
      if (!isNew) {
        const existing = await api.get(`/snippets/${id}`).then(s => s.tags || []);
        for (const t of existing.filter(t => !tags.includes(t))) {
          await api.del(`/tags/${id}/${t}`).catch(() => {});
        }
      }
      const sid = snippet.id;
      for (const t of tags) {
        await api.post(`/tags/${sid}`, { tag: t }).catch(() => {});
      }

      toast(isNew ? 'Snippet created' : 'Snippet saved', 'success');
      navigate(`/snippet/${snippet.id}`);
    } catch (err) {
      toast(err.message, 'error');
      setSaving(false);
    }
  };

  const isSensitive = encryptionMode === 'sensitive';

  return (
    <div>
      <Header />
      <div className={styles.page}>
        <div className={styles.topBar}>
          <button className="btn-ghost" onClick={() => navigate(isNew ? '/vault' : `/snippet/${id}`)}>
            ← {isNew ? 'Vault' : 'Back'}
          </button>
          <h1 className={styles.heading}>{isNew ? 'New snippet' : 'Edit snippet'}</h1>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save snippet'}
          </button>
        </div>

        <div className={styles.layout}>
          <div className={styles.form}>
            <input
              className={`input-glass ${styles.titleInput}`}
              placeholder="Snippet title…"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <div className={styles.descRow}>
              <input
                className="input-glass"
                placeholder="Description (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className={styles.suggestBtn}
                onClick={handleSuggest}
                disabled={suggesting || !code.trim()}
                title="Let AI suggest a title and description based on your code"
              >
                {suggesting ? '…' : '✦ AI Suggest'}
              </button>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Language</label>
                <select className={`select-glass ${styles.fullWidth}`} value={language} onChange={e => setLanguage(e.target.value)}>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Visibility</label>
                <select className={`select-glass ${styles.fullWidth}`} value={visibility} onChange={e => setVisibility(e.target.value)}>
                  <option value="private">🔒 Private</option>
                  <option value="project">◈ Project</option>
                  <option value="shared">◌ Shared</option>
                </select>
              </div>
              {projects.length > 0 && (
                <div className={styles.field}>
                  <label className={styles.label}>Project</label>
                  <select className={`select-glass ${styles.fullWidth}`} value={projectId} onChange={e => setProjectId(e.target.value)}>
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className={styles.encRow}>
              <div className={`${styles.encOption} ${!isSensitive ? styles.encActive : ''}`} onClick={() => setEncryptionMode('standard')}>
                <span className={styles.encIcon}>◎</span>
                <div>
                  <p className={styles.encTitle}>Standard</p>
                  <p className={styles.encDesc}>Plaintext — access controlled by visibility</p>
                </div>
                {!isSensitive && <span className={styles.encCheck}>✓</span>}
              </div>
              <div className={`${styles.encOption} ${isSensitive ? styles.encSensitiveActive : ''}`} onClick={() => setEncryptionMode('sensitive')}>
                <span className={styles.encIcon}>🔒</span>
                <div>
                  <p className={styles.encTitle}>Sensitive</p>
                  <p className={styles.encDesc}>Client-side sealed box — zero-knowledge</p>
                </div>
                {isSensitive && <span className={styles.encCheck}>✓</span>}
              </div>
            </div>

            {isSensitive && (
              <div className={styles.field}>
                <label className={styles.label}>Expiry (optional)</label>
                <input
                  type="datetime-local"
                  className="input-glass"
                  value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                />
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>Tags</label>
              <div className={styles.tagBox}>
                {tags.map(t => (
                  <span key={t} className={styles.tagChip}>
                    {t}
                    <button className={styles.tagRemove} onClick={() => removeTag(t)}>×</button>
                  </span>
                ))}
                <input
                  className={styles.tagInput}
                  placeholder="Add tag, press Enter…"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKey}
                  onBlur={addTag}
                />
              </div>
            </div>

            <div className={styles.editorWrap}>
              <Editor
                height="420px"
                language={language}
                value={code}
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                onChange={val => setCode(val || '')}
                options={{ minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, lineNumbersMinChars: 3 }}
              />
            </div>
          </div>

          <aside className={styles.hints}>
            <div className={`glass-card ${styles.hintCard}`}>
              <h3 className={styles.hintTitle}>Mode</h3>
              <div className={styles.hintRow}>
                <span className="badge badge-teal">Standard</span>
                <p className={styles.hintText}>Stored as plaintext. Access controlled by visibility. Searchable and AI-ready.</p>
              </div>
              <div className={styles.hintRow}>
                <span className="badge badge-amber">Sensitive</span>
                <p className={styles.hintText}>Encrypted in your browser before upload. Server never sees plaintext. Not indexed, no AI.</p>
              </div>
            </div>
            <div className={`glass-card ${styles.hintCard}`}>
              <h3 className={styles.hintTitle}>Visibility</h3>
              <div className={styles.hintRow}><span className="badge badge-indigo">Private</span><p className={styles.hintText}>Only you</p></div>
              <div className={styles.hintRow}><span className="badge badge-sky">Project</span><p className={styles.hintText}>Project members only</p></div>
              <div className={styles.hintRow}><span className="badge badge-emerald">Shared</span><p className={styles.hintText}>All logged-in users</p></div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
