import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import styles from './ProjectSwitcher.module.css';
import type { Project } from '../types';

interface Props {
  selectedProject: number | null;
  onProjectChange: (id: number | null) => void;
}

export default function ProjectSwitcher({ selectedProject, onProjectChange }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    api.get<Project[]>('/projects').then(setProjects).catch(() => {});
  }, []);

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>Projects</p>
      <button
        className={selectedProject === null ? styles.itemActive : styles.item}
        onClick={() => onProjectChange(null)}
      >
        All
      </button>
      {projects.map(p => (
        <button
          key={p.id}
          className={selectedProject === p.id ? styles.itemActive : styles.item}
          onClick={() => onProjectChange(p.id)}
          title={p.description || p.name}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}
