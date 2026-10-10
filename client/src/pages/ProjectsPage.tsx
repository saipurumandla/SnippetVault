import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { shortDate } from '../lib/dates';
import { useToast } from '../context/ToastContext';
import Header from '../components/Header';
import { CLOUD } from '../lib/providers';
import type { AiSettings, CloudProvider, Project, UserSummary } from '../types';
import styles from './ProjectsPage.module.css';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [description, setDescription] = useState('');
  const [memberEmail, setMemberEmail] = useState<Record<number, string>>({});
  const [owned, setOwned] = useState<Record<number, CloudProvider[]>>({});
  const { toast } = useToast();

  const load = () => {
    setLoadError('');
    api.get<Project[]>('/projects')
      .then(setProjects)
      .catch(err => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
    api.get<AiSettings>('/ai')
      .then(s => setOwned(Object.fromEntries(s.projects.map(p => [p.id, p.consent]))))
      .catch(() => {});
  };

  const setCloud = async (projectId: number, provider: CloudProvider, allow: boolean) => {
    try {
      await api.put('/ai/consent', { provider, projectId, allow });
      setOwned(prev => ({ ...prev, [projectId]: allow ? [...(prev[projectId] ?? []), provider] : (prev[projectId] ?? []).filter(x => x !== provider) }));
      toast(allow ? 'Cloud model allowed for this project' : 'Cloud model not allowed anymore', 'success');
    } catch (err) { toast(errorMessage(err), 'error'); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setNameError('Name is required'); return; }
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
      if (!target) { toast(`No user with email ${email}`, 'error'); return; }
      await api.post(`/projects/${projectId}/members`, { userId: target.id });
      toast(`${email} added`, 'success');
      setMemberEmail(prev => ({ ...prev, [projectId]: '' }));
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <div>
      <Header />
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Projects</h1>
          {!showCreate && (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} strokeWidth={1.75} />
              New project
            </button>
          )}
        </div>

        {showCreate && (
          <form className={styles.createForm} onSubmit={handleCreate}>
            <div>
              <label className="field-label" htmlFor="project-name">Name<span className="required">*</span></label>
              <input id="project-name" className="input" value={name} aria-invalid={!!nameError} autoFocus
                onChange={e => { setName(e.target.value); setNameError(''); }} />
              {nameError && <p className="field-error">{nameError}</p>}
            </div>
            <div>
              <label className="field-label" htmlFor="project-desc">Description</label>
              <input id="project-desc" className="input" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className={styles.formActions}>
              <button type="submit" className="btn-primary">Create project</button>
              <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <p className={styles.note}>Loading projects…</p>
        ) : loadError ? (
          <div className={styles.note}>
            <p>Could not load projects: {loadError}</p>
            <button className="btn-ghost" onClick={load}>Try again</button>
          </div>
        ) : projects.length === 0 ? (
          <p className={styles.note}>No projects yet. A project groups snippets for a team or a repo.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Created</th>
                <th>Cloud models</th>
                <th>Add member</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id}>
                  <td className={styles.name}>{p.name}</td>
                  <td className={styles.muted}>{p.description || '—'}</td>
                  <td className={styles.muted}>{shortDate(p.created_at)}</td>
                  <td>
                    {owned[p.id] ? (
                      <div className={styles.cloud}>
                        {CLOUD.map(c => (
                          <label key={c.id} className={styles.cloudOption}>
                            <input type="checkbox" checked={owned[p.id]!.includes(c.id)} onChange={e => setCloud(p.id, c.id, e.target.checked)} />
                            {c.label}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <span className={styles.muted}>owner decides</span>
                    )}
                  </td>
                  <td>
                    <form className={styles.memberForm} onSubmit={e => handleAddMember(p.id, e)}>
                      <input
                        className="input"
                        type="email"
                        placeholder="teammate@example.com"
                        aria-label={`Add member to ${p.name}`}
                        value={memberEmail[p.id] || ''}
                        onChange={e => setMemberEmail(prev => ({ ...prev, [p.id]: e.target.value }))}
                      />
                      <button type="submit" className="btn-ghost">Add</button>
                    </form>
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
