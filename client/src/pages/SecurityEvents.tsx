import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import Header from '../components/Header';
import styles from './SecurityEvents.module.css';
import type { SecurityEvent } from '../types';

const EVENT_COLORS: Record<string, string> = {
  share: 'badge-violet',
  decrypt: 'badge-teal',
  export: 'badge-sky',
  revoke: 'badge-rose',
  login: 'badge-emerald',
};

export default function SecurityEvents() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<SecurityEvent[]>('/security/events').then(setEvents).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Header />
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Security Events</h1>
        </div>
        <div className={styles.notice}>
          <span className="badge badge-teal">🛡 Audit Log</span>
          <p>All decrypt, share, export, and revoke actions are recorded here. This log is append-only.</p>
        </div>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🛡</div>
            <p className="empty-state-text">No security events recorded yet.</p>
          </div>
        ) : (
          <div className={styles.list}>
            {events.map(e => (
              <div key={e.id} className={`glass-card ${styles.event}`}>
                <span className={`badge ${EVENT_COLORS[e.event_type] || 'badge-indigo'}`}>{e.event_type}</span>
                <span className={styles.eventMeta}>{new Date(e.created_at).toLocaleString()}</span>
                {e.snippet_id && <span className={styles.eventSnippet}>snippet #{e.snippet_id}</span>}
                {e.meta && <span className={styles.eventDetail}>{e.meta}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
