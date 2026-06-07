import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { longDate } from '../lib/dates';
import Header from '../components/Header';
import type { SecurityEvent } from '../types';
import styles from './Table.module.css';

function describe(e: SecurityEvent): string {
  if (!e.meta) return '';
  try {
    const meta = JSON.parse(e.meta) as Record<string, unknown>;
    if (e.event_type === 'mcp_tool') {
      const why = meta.ok ? '' : meta.reason === 'rate_limited' ? ', rate limited' : meta.reason === 'scope' ? ', missing scope' : meta.reason ? `, ${String(meta.reason)}` : ', not found';
      return `${String(meta.tool)} via ${String(meta.token)}${why}`;
    }
    if (typeof meta.recipientCount === 'number') return `${meta.recipientCount} recipient${meta.recipientCount === 1 ? '' : 's'}`;
    return Object.entries(meta).map(([k, v]) => `${k}: ${String(v)}`).join(', ');
  } catch {
    return e.meta;
  }
}

export default function SecurityEvents() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = () => {
    setLoadError('');
    api.get<SecurityEvent[]>('/security/events')
      .then(setEvents)
      .catch(err => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <Header />
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Security events</h1>
        </div>
        <p className={styles.intro}>Shares of sensitive snippets and every tool call from an agent (MCP) are recorded here. The app only adds to this log, it never changes it.</p>

        {loading ? (
          <p className={styles.note}>Loading events…</p>
        ) : loadError ? (
          <div className={styles.note}>
            <p>Could not load events: {loadError}</p>
            <button className="btn-ghost" onClick={load}>Try again</button>
          </div>
        ) : events.length === 0 ? (
          <p className={styles.note}>No events yet. They appear when you share a sensitive snippet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Snippet</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map(e => (
                <tr key={e.id}>
                  <td className={styles.muted}>{longDate(e.created_at)}</td>
                  <td className={styles.strong}>{e.event_type}</td>
                  <td>{e.snippet_id ? <a href={`/snippet/${e.snippet_id}`} className={styles.mono}>#{e.snippet_id}</a> : '—'}</td>
                  <td className={styles.muted}>{describe(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
