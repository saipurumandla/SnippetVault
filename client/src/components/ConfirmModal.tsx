import { useEscape } from './useEscape';
import styles from './Dialog.module.css';

interface Props {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }: Props) {
  useEscape(onCancel);
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={e => e.stopPropagation()}>
        <h2 id="confirm-title" className={styles.title}>{title}</h2>
        {message && <p className={styles.text}>{message}</p>}
        <div className={styles.actions}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={danger ? styles.dangerBtn : 'btn-primary'} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
