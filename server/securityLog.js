const db = require('./db');
const pino = require('pino');

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

function logEvent(userId, eventType, snippetId, meta) {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO security_events (user_id, event_type, snippet_id, meta, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userId,
    eventType,
    snippetId || null,
    meta ? JSON.stringify(meta) : null,
    now
  );
  log.info({ userId, eventType, snippetId, meta }, 'security_event');
}

module.exports = { logEvent };
