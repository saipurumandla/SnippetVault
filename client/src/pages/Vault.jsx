import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import SnippetCard from '../components/SnippetCard';
import Header from '../components/Header';
import RagPanel from '../components/RagPanel';
import ConfirmModal from '../components/ConfirmModal';
import styles from './Vault.module.css';

const LANG_META = [
  { id: 'javascript', label: 'JS',   color: '#f5a623' },
  { id: 'typescript', label: 'TS',   color: '#38bdf8' },
  { id: 'python',     label: 'PY',   color: '#10d98a' },
  { id: 'bash',       label: 'Bash', color: '#a78bfa' },
  { id: 'sql',        label: 'SQL',  color: '#c084fc' },
  { id: 'json',       label: 'JSON', color: '#6b7a8d' },
  { id: 'yaml',       label: 'YML',  color: '#6b7a8d' },
  { id: 'html',       label: 'HTML', color: '#fda4af' },
  { id: 'css',        label: 'CSS',  color: '#67e8f9' },
  { id: 'go',         label: 'GO',   color: '#00d4e8' },
  { id: 'rust',       label: 'RS',   color: '#fb923c' },
  { id: 'java',       label: 'Java', color: '#f87171' },
  { id: 'csharp',     label: 'C#',   color: '#818cf8' },
  { id: 'cpp',        label: 'C++',  color: '#f43f5e' },
  { id: 'markdown',   label: 'MD',   color: '#4a5568' },
  { id: 'plaintext',  label: 'TXT',  color: '#3d4a5c' },
];

export default function Vault() {
  const [snippets, setSnippets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLang, setSelectedLang] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTag, setSelectedTag] = useState('');
  const [showRag, setShowRag] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (selectedLang) params.set('language', selectedLang);
    if (selectedProject) params.set('project_id', selectedProject);
    try {
      const qs = params.toString() ? `?${params}` : '';
      const [snips, projs, tagList] = await Promise.all([
        api.get(`/snippets${qs}`),
        api.get('/projects'),
        api.get('/tags'),
      ]);
      let filtered = snips;
      if (selectedTag) filtered = filtered.filter(s => s.tags?.includes(selectedTag));
      setSnippets(filtered);
      setProjects(projs);
      setTags(tagList);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, selectedLang, selectedProject, selectedTag]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    setConfirmDelete(id);
  };

  const confirmDoDelete = async () => {
    const id = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.del(`/snippets/${id}`);
      setSnippets(prev => prev.filter(s => s.id !== id));
      toast('Snippet deleted', 'success');
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div className={styles.shell}>
      {confirmDelete && (
        <ConfirmModal
          title="Delete snippet?"
          message="This will permanently remove the snippet and all its versions. There's no undo."
          confirmLabel="Delete"
          danger
          onConfirm={confirmDoDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <aside className={styles.sidebar}>
        <div className={styles.sideSection}>
          <p className={styles.sideLabel}>Language</p>
          <div className={styles.langGrid}>
            <button
              className={`${styles.langChip} ${!selectedLang ? styles.langChipAll : ''}`}
              onClick={() => setSelectedLang('')}
            >
              All
            </button>
            {LANG_META.map(l => (
              <button
                key={l.id}
                className={`${styles.langChip} ${selectedLang === l.id ? styles.langChipActive : ''}`}
                onClick={() => setSelectedLang(l.id)}
                title={l.id}
                style={{ '--lc': l.color }}
              >
                <span className={styles.langDot} style={{ background: l.color }} />
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {projects.length > 0 && (
          <div className={styles.sideSection}>
            <p className={styles.sideLabel}>Projects</p>
            <button className={`${styles.sideItem} ${!selectedProject ? styles.sideActive : ''}`} onClick={() => setSelectedProject(null)}>◈ All</button>
            {projects.map(p => (
              <button key={p.id} className={`${styles.sideItem} ${selectedProject === p.id ? styles.sideActive : ''}`} onClick={() => setSelectedProject(p.id)}>
                ◈ {p.name}
              </button>
            ))}
          </div>
        )}

        {tags.length > 0 && (
          <div className={styles.sideSection}>
            <p className={styles.sideLabel}>Tags</p>
            <div className={styles.tagPills}>
              <button className={`${styles.tagPill} ${!selectedTag ? styles.tagPillActive : ''}`} onClick={() => setSelectedTag('')}>all</button>
              {tags.map(t => (
                <button key={t} className={`${styles.tagPill} ${selectedTag === t ? styles.tagPillActive : ''}`} onClick={() => setSelectedTag(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      <div className={styles.main}>
        <Header onSearch={setSearch} searchValue={search} />

        <div className={styles.content}>
          <div className={styles.toolbar}>
            <div className={styles.counts}>
              {!loading && (
                <span className={styles.count}>{snippets.length} snippet{snippets.length !== 1 ? 's' : ''}</span>
              )}
              {(selectedLang || selectedProject || selectedTag || search) && (
                <button className={styles.clearFilters} onClick={() => { setSelectedLang(''); setSelectedProject(null); setSelectedTag(''); setSearch(''); }}>
                  Clear filters
                </button>
              )}
            </div>
            <button
              className={`${styles.ragToggle} ${showRag ? styles.ragToggleActive : ''}`}
              onClick={() => setShowRag(s => !s)}
              title="Ask AI about your snippets"
            >
              ✦ Ask AI
            </button>
          </div>

          {showRag && (
            <div className={styles.ragWrap}>
              <RagPanel />
            </div>
          )}

          {loading ? (
            <div className={styles.loadingGrid}>
              {[...Array(6)].map((_, i) => <div key={i} className={styles.skeleton} />)}
            </div>
          ) : snippets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">⬡</div>
              <p className="empty-state-text">
                {search || selectedLang || selectedProject || selectedTag
                  ? 'No snippets match your filters.'
                  : 'Your vault is empty.\nClick "+ New Snippet" to get started.'}
              </p>
              {!search && !selectedLang && !selectedProject && !selectedTag && (
                <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/snippet/new')}>
                  + New Snippet
                </button>
              )}
            </div>
          ) : (
            <div className={styles.grid}>
              {snippets.map(s => (
                <SnippetCard key={s.id} snippet={s} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
