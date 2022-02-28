import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import styles from './Header.module.css';

export default function Header() {
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className={styles.header}>
      <span className={styles.logo} onClick={() => navigate('/vault')}>SnippetVault</span>
      <div className={styles.right}>
        <button className={styles.themeBtn} onClick={toggle} title="Toggle theme">
          {theme === 'dark' ? '☀' : '●'}
        </button>
        <button className={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
      </div>
    </header>
  );
}
