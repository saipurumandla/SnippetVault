import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import styles from './NavSidebar.module.css';

const NAV = [
  { to: '/vault',          icon: '⬡', label: 'Vault' },
  { to: '/projects',       icon: '◈', label: 'Projects' },
  { to: '/expired',        icon: '⏳', label: 'Expired' },
  { to: '/security',       icon: '🛡', label: 'Security' },
  { to: '/backup',         icon: '☁', label: 'Backup' },
  { to: '/settings',       icon: '⚙', label: 'Settings' },
  { to: '/docs',           icon: '📖', label: 'Docs' },
];

export default function NavSidebar() {
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <nav className={styles.nav}>
      <div className={styles.logo} onClick={() => navigate('/vault')}>
        <span className={styles.logoIcon}>⬡</span>
        <span className={styles.logoText}>SnippetVault</span>
      </div>
      <div className={styles.links}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.linkIcon}>{icon}</span>
            <span className={styles.linkLabel}>{label}</span>
          </NavLink>
        ))}
      </div>
      <div className={styles.bottom}>
        <button className={styles.themeBtn} onClick={toggle} title="Toggle theme">
          {theme === 'dark' ? '☀' : '●'}
        </button>
        <button className={styles.logoutBtn} onClick={() => { logout(); navigate('/login'); }}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
