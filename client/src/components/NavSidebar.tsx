import { NavLink, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Archive, FolderOpen, Clock, ShieldCheck, HardDrive, Settings2, BookOpen, LogOut, Sun, Moon, KeyRound } from 'lucide-react';
import styles from './NavSidebar.module.css';

const NAV = [
  { to: '/vault',    Icon: Archive,      label: 'Vault' },
  { to: '/projects', Icon: FolderOpen,   label: 'Projects' },
  { to: '/expired',  Icon: Clock,        label: 'Expired' },
  { to: '/security', Icon: ShieldCheck,  label: 'Security' },
  { to: '/backup',   Icon: HardDrive,    label: 'Backup' },
  { to: '/tokens',   Icon: KeyRound,     label: 'Access tokens' },
  { to: '/settings', Icon: Settings2,    label: 'Settings' },
  { to: '/docs',     Icon: BookOpen,     label: 'Docs' },
];

export default function NavSidebar() {
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <nav className={styles.nav}>
      <div className={styles.logo} onClick={() => navigate('/vault')}>
        <Archive size={18} className={styles.logoIconSvg} />
        <span className={styles.logoText}>SnippetVault</span>
      </div>
      <div className={styles.links}>
        {NAV.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            <Icon size={16} strokeWidth={1.75} className={styles.linkIcon} />
            <span className={styles.linkLabel}>{label}</span>
          </NavLink>
        ))}
      </div>
      <div className={styles.bottom}>
        <button
          className={styles.themeBtn}
          onClick={toggle}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
        </button>
        <button className={styles.logoutBtn} onClick={() => { logout(); navigate('/login'); }}>
          <LogOut size={16} strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </nav>
  );
}
