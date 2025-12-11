import React from 'react';
import { useToast } from '../context/ToastContext';
import styles from './Toast.module.css';

const ICONS = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;

  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`} onClick={() => dismiss(t.id)}>
          <span className={styles.icon}>{ICONS[t.type]}</span>
          <span className={styles.msg}>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
