import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { api } from '../lib/api';
import styles from './SnippetEditor.module.css';

const LANGUAGES = ['javascript', 'typescript', 'python', 'bash', 'sql', 'json', 'yaml', 'html', 'css', 'go', 'rust', 'java', 'csharp', 'cpp', 'markdown', 'plaintext'];

export default function SnippetEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [visibility, setVisibility] = useState('private');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) {
      api.get(`/snippets/${id}`)
        .then(s => {
          setTitle(s.title);
          setDescription(s.description || '');
          setCode(s.code);
          setLanguage(s.language);
          setVisibility(s.visibility);
        })
        .catch(err => setError(err.message));
    }
  }, [id, isNew]);

  const handleSave = async () => {
    if (!title.trim() || !code.trim()) {
      setError('Title and code are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = { title, description, code, language, visibility };
      if (isNew) {
        const snippet = await api.post('/snippets', body);
        navigate(`/snippet/${snippet.id}`);
      } else {
        await api.put(`/snippets/${id}`, body);
        navigate(`/snippet/${id}`);
      }
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(isNew ? '/vault' : `/snippet/${id}`)}>← Cancel</button>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <input
        className={styles.titleInput}
        placeholder="Snippet title"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <input
        className={styles.descInput}
        placeholder="Description (optional)"
        value={description}
        onChange={e => setDescription(e.target.value)}
      />
      <div className={styles.controls}>
        <select className={styles.select} value={language} onChange={e => setLanguage(e.target.value)}>
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select className={styles.select} value={visibility} onChange={e => setVisibility(e.target.value)}>
          <option value="private">Private</option>
          <option value="project">Project</option>
          <option value="shared">Shared</option>
        </select>
      </div>
      <div className={styles.editor}>
        <Editor
          height="450px"
          language={language}
          value={code}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          onChange={val => setCode(val || '')}
          options={{ minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13 }}
        />
      </div>
    </div>
  );
}
