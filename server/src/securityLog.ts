import pino from 'pino';
import db from './db.js';
import { config } from './config.js';

const log = pino({ level: config.logLevel });

export function logEvent(userId: number, eventType: string, snippetId?: number | null, meta?: Record<string, unknown>): void {
  db.prepare('INSERT INTO security_events (user_id, event_type, snippet_id, meta, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userId,
    eventType,
    snippetId ?? null,
    meta ? JSON.stringify(meta) : null,
    new Date().toISOString(),
  );
  log.info({ userId, eventType, snippetId, meta }, 'security_event');
}
