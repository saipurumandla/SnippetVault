import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { MessageSquareText, X } from 'lucide-react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { LANGUAGES } from '../lib/languages';
import { useToast } from '../context/ToastContext';
import Header from '../components/Header';
import RagPanel from '../components/RagPanel';
import ConfirmModal from '../components/ConfirmModal';
import SnippetRow from '../components/SnippetRow';
import SnippetPreview from '../components/SnippetPreview';
import type { Project, Snippet } from '../types';
import { isTypingTarget } from '../lib/keyboard';
import styles from './Vault.module.css';

export default function Vault() {
  const [searchParams] = useSearchParams();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [tag, setTag] = useState(() => searchParams.get('tag') ?? '');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAsk, setShowAsk] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const rowRefs = useRef(new Map<number, HTMLLIElement>());
  const { toast } = useToast();
  const navigate = useNavigate();

  const filtered = !!(search || language || projectId || tag);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (language) params.set('language', language);
    if (projectId) params.set('project_id', String(projectId));
    try {
      const qs = params.toString() ? `?${params}` : '';
      const [list, projs, tagList] = await Promise.all([
        api.get<Snippet[]>(`/snippets${qs}`),
        api.get<Project[]>('/projects'),
        api.get<string[]>('/tags'),
      ]);
      setSnippets(tag ? list.filter(s => s.tags.includes(tag)) : list);
      setProjects(projs);
      setTags(tagList);
    } catch (err) {
      setFailed(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, language, projectId, tag]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!snippets.some(s => s.id === selectedId)) setSelectedId(snippets[0]?.id ?? null);
  }, [snippets, selectedId]);

  const move = useCallback((step: number) => {
    const i = snippets.findIndex(s => s.id === selectedId);
    const next = snippets[Math.min(Math.max(i + step, 0), snippets.length - 1)];
    if (!next) return;
    setSelectedId(next.id);
    rowRefs.current.get(next.id)?.scrollIntoView({ block: 'nearest' });
  }, [snippets, selectedId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || confirmDelete !== null || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      if (e.key === 'Enter' && selectedId !== null) navigate(`/snippet/${selectedId}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, selectedId, navigate, confirmDelete]);

  const clearFilters = () => {
    setSearch('');
    setLanguage('');
    setProjectId(null);
    setTag('');
  };

  const doDelete = async () => {
    const id = confirmDelete;
    setConfirmDelete(null);
    if (id === null) return;
    try {
      await api.del(`/snippets/${id}`);
      setSnippets(prev => prev.filter(s => s.id !== id));
      toast('Snippet deleted', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const selected = snippets.find(s => s.id === selectedId) ?? null;

  return (
    <div className={styles.shell}>
      {confirmDelete !== null && (
        <ConfirmModal
          title="Delete this snippet?"
          message="The snippet and all its versions are removed. This can't be undone."
          confirmLabel="Delete snippet"
          danger
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <Header onSearch={setSearch} searchValue={search} />

      <div className={styles.filters}>
        <select className={`select ${styles.filter}`} aria-label="Language" value={language} onChange={e => setLanguage(e.target.value)}>
          <option value="">All languages</option>
          {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <select
          className={`select ${styles.filter}`}
          aria-label="Project"
          value={projectId ?? ''}
          onChange={e => setProjectId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className={`select ${styles.filter}`} aria-label="Tag" value={tag} onChange={e => setTag(e.target.value)}>
          <option value="">All tags</option>
          {tags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {filtered && (
          <button className="btn-ghost" onClick={clearFilters}>
            <X size={16} strokeWidth={1.75} />
            Clear
          </button>
        )}
        <span className={styles.count}>
          {!loading && `${snippets.length} snippet${snippets.length === 1 ? '' : 's'}`}
        </span>
        <button className={`btn-ghost ${showAsk ? styles.askOn : ''}`} onClick={() => setShowAsk(v => !v)} aria-pressed={showAsk}>
          <MessageSquareText size={16} strokeWidth={1.75} />
          Ask your vault
        </button>
      </div>

      {showAsk && (
        <div className={styles.ask}>
          <RagPanel onCite={setSelectedId} />
        </div>
      )}

      <div className={styles.body}>
        <div className={styles.listPane}>
          {loading && snippets.length === 0 ? (
            <p className={styles.note}>Loading snippets…</p>
          ) : failed ? (
            <div className={styles.note}>
              <p>Could not load snippets: {failed}</p>
              <button className="btn-ghost" onClick={load}>Try again</button>
            </div>
          ) : snippets.length === 0 ? (
            <div className={styles.note}>
              {filtered ? (
                <>
                  <p>No snippets match these filters.</p>
                  <button className="btn-ghost" onClick={clearFilters}>Clear filters</button>
                </>
              ) : (
                <>
                  <p>Your vault is empty. Press <kbd>N</kbd> to add your first snippet.</p>
                  <button className="btn-primary" onClick={() => navigate('/snippet/new')}>New snippet</button>
                </>
              )}
            </div>
          ) : (
            <ul className={styles.list} role="listbox" aria-label="Snippets">
              {snippets.map(s => (
                <SnippetRow
                  key={s.id}
                  ref={el => { if (el) rowRefs.current.set(s.id, el); else rowRefs.current.delete(s.id); }}
                  snippet={s}
                  selected={s.id === selectedId}
                  onSelect={() => setSelectedId(s.id)}
                  onOpen={() => navigate(`/snippet/${s.id}`)}
                />
              ))}
            </ul>
          )}
        </div>
        <div className={styles.previewPane}>
          {selected ? (
            <SnippetPreview snippet={selected} onDelete={setConfirmDelete} />
          ) : (
            !loading && snippets.length > 0 && <p className={styles.note}>Select a snippet to preview it.</p>
          )}
        </div>
      </div>
    </div>
  );
}
