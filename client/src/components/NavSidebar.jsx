import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Archive, FolderOpen, Clock, ShieldCheck, HardDrive, Settings2, BookOpen, LogOut } from 'lucide-react';
import styles from './NavSidebar.module.css';

const NAV = [
  { to: '/vault',    Icon: Archive,      label: 'Vault' },
  { to: '/projects', Icon: FolderOpen,   label: 'Projects' },
  { to: '/expired',  Icon: Clock,        label: 'Expired' },
  { to: '/security', Icon: ShieldCheck,  label: 'Security' },
  { to: '/backup',   Icon: HardDrive,    label: 'Backup' },
  { to: '/settings', Icon: Settings2,    label: 'Settings' },
  { to: '/docs',     Icon: BookOpen,     label: 'Docs' },
];

export default function NavSidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className={styles.nav}>
      <div className={styles.logo} onClick={() => navigate('/vault')}>
        <Archive size={20} className={styles.logoIconSvg} />
        <span className={styles.logoText}>SnippetVault</span>
      </div>
      <div className={styles.links}>
        {NAV.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            <Icon size={17} className={styles.linkIcon} />
            <span className={styles.linkLabel}>{label}</span>
          </NavLink>
        ))}
      </div>
      <div className={styles.bottom}>
        <button className={styles.logoutBtn} onClick={() => { logout(); navigate('/login'); }}>
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </nav>
  );
}
