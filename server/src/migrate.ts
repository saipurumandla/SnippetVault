import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { config, isMain } from './config.js';

export const MIGRATIONS_DIR = path.join(import.meta.dirname, '../migrations');

export function migrate(db: Database.Database, dir = MIGRATIONS_DIR): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const rows = db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[];
  const done = new Set(rows.map(r => r.version));
  const files = fs.readdirSync(dir).filter(f => /^\d{3}_[\w-]+\.sql$/.test(f)).sort();
  const record = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');
  const applied: string[] = [];

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (done.has(version)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      record.run(version, new Date().toISOString());
    })();
    applied.push(version);
  }
  return applied;
}

if (isMain(import.meta.url)) {
  const { openDb } = await import('./sqlite.js');
  const applied = migrate(openDb(config.dbPath));
  console.log(applied.length ? `applied: ${applied.join(', ')}` : 'nothing to apply');
}
