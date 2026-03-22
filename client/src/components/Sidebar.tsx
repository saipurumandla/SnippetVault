import ProjectSwitcher from './ProjectSwitcher';
import styles from './Sidebar.module.css';

const LANGUAGES = ['javascript', 'typescript', 'python', 'bash', 'sql', 'json', 'yaml', 'html', 'css', 'go', 'rust', 'java', 'csharp', 'cpp', 'markdown', 'plaintext'];

interface Props {
  selectedLang: string;
  onLangChange: (lang: string) => void;
  selectedProject: number | null;
  onProjectChange: (id: number | null) => void;
}

export default function Sidebar({ selectedLang, onLangChange, selectedProject, onProjectChange }: Props) {
  return (
    <aside className={styles.sidebar}>
      <p className={styles.label}>Language</p>
      <button
        className={selectedLang === '' ? styles.itemActive : styles.item}
        onClick={() => onLangChange('')}
      >
        All
      </button>
      {LANGUAGES.map(l => (
        <button
          key={l}
          className={selectedLang === l ? styles.itemActive : styles.item}
          onClick={() => onLangChange(l)}
        >
          {l}
        </button>
      ))}
      <ProjectSwitcher selectedProject={selectedProject} onProjectChange={onProjectChange} />
    </aside>
  );
}
