import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import type { ToastType } from '../types';
import styles from './Toast.module.css';

const ICONS: Record<ToastType, LucideIcon> = { success: CircleCheck, error: CircleX, info: Info, warning: TriangleAlert };

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;

  return (
    <div className={styles.container} role="status" aria-live="polite">
      {toasts.map(t => {
        const Icon = ICONS[t.type];
        return (
          <button key={t.id} type="button" className={`${styles.toast} ${styles[t.type]}`} onClick={() => dismiss(t.id)}>
            <Icon size={16} strokeWidth={1.75} className={styles.icon} />
            <span className={styles.msg}>{t.message}</span>
          </button>
        );
      })}
    </div>
  );
}
