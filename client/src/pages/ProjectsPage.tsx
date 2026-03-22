import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import Header from '../components/Header';
import styles from './ProjectsPage.module.css';
import { errorMessage } from '../lib/errors';
import type { Project, UserSummary } from '../types';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberEmail, setMemberEmail] = useState<Record<number, string>>({});
  const { toast } = useToast();

  const load = () => {
    api.get<Project[]>('/projects').then(setProjects).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post('/projects', { name: name.trim(), description: description.trim() || undefined });
      toast('Project created', 'success');
      setName(''); setDescription(''); setShowCreate(false);
      load();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  const handleAddMember = async (projectId: number, e: FormEvent) => {
    e.preventDefault();
    const email = memberEmail[projectId]?.trim();
    if (!email) return;
    try {
      const allUsers = await api.get<UserSummary[]>('/auth/users').catch((): UserSummary[] => []);
      const target = allUsers.find(u => u.email === email);
      if (!target) { toast('User not found', 'error'); return; }
      await api.post(`/projects/${projectId}/members`, { userId: target.id });
      toast('Member added', 'success');
      setMemberEmail(prev => ({ ...prev, [projectId]: '' }));
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <div>
      <Header />
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Projects</h1>
          <button className="btn-primary" onClick={() => setShowCreate(s => !s)}>
            {showCreate ? 'Cancel' : '+ New Project'}
          </button>
        </div>

        {showCreate && (
          <form className={styles.createForm} onSubmit={handleCreate}>
            <h2 className={styles.formTitle}>Create project</h2>
            <input className="input-glass" placeholder="Project name" value={name} onChange={e => setName(e.target.value)} required />
            <input className="input-glass" placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn-primary">Create</button>
              <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <p style={{ color: 'var(--text-muted)', marginTop: 32 }}>Loading…</p>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◈</div>
            <p className="empty-state-text">No projects yet.<br />Create one to organise snippets by team or repo.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {projects.map(p => (
              <div key={p.id} className={`glass-card ${styles.card}`}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardName}>{p.name}</span>
                  <span className="badge badge-indigo">Project</span>
                </div>
                {p.description && <p className={styles.cardDesc}>{p.description}</p>}
                <p className={styles.cardMeta}>Created {new Date(p.created_at).toLocaleDateString()}</p>
                <form className={styles.memberForm} onSubmit={e => handleAddMember(p.id, e)}>
                  <input
                    className="input-glass"
                    placeholder="Add member by email"
                    value={memberEmail[p.id] || ''}
                    onChange={e => setMemberEmail(prev => ({ ...prev, [p.id]: e.target.value }))}
                  />
                  <button type="submit" className="btn-ghost" style={{ whiteSpace: 'nowrap' }}>Add</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
