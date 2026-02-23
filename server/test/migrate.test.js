import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrate, MIGRATIONS_DIR } from '../src/migrate.ts';

function tmpDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-mig-'));
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql);
  return dir;
}

describe('migrate', () => {
  it('applies the real migrations once', () => {
    const db = new Database(':memory:');
    const first = migrate(db);
    expect(first[0]).toBe('001_initial');
    expect(migrate(db)).toEqual([]);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(t => t.name);
    expect(tables).toEqual(expect.arrayContaining(['users', 'snippets', 'schema_migrations', 'rag_chunks']));
    expect(fs.readdirSync(MIGRATIONS_DIR).length).toBeGreaterThan(0);
  });

  it('runs in file order and skips non migration files', () => {
    const dir = tmpDir({
      '002_b.sql': 'CREATE TABLE b (id INTEGER);',
      '001_a.sql': 'CREATE TABLE a (id INTEGER);',
      'notes.txt': 'not sql',
    });
    const db = new Database(':memory:');
    expect(migrate(db, dir)).toEqual(['001_a', '002_b']);
  });

  it('rolls back a broken migration', () => {
    const dir = tmpDir({
      '001_ok.sql': 'CREATE TABLE ok (id INTEGER);',
      '002_bad.sql': 'CREATE TABLE half (id INTEGER); THIS IS NOT SQL;',
    });
    const db = new Database(':memory:');
    expect(() => migrate(db, dir)).toThrow();
    const versions = db.prepare('SELECT version FROM schema_migrations').all().map(r => r.version);
    expect(versions).toEqual(['001_ok']);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'half'").get()).toBeUndefined();
  });

  it('is safe on a database made by the old schema.sql', () => {
    const db = new Database(':memory:');
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, '001_initial.sql'), 'utf8'));
    db.prepare("INSERT INTO users (email, password_hash, created_at) VALUES ('x@y.z', 'h', 'now')").run();
    expect(migrate(db)).toEqual(['001_initial']);
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(1);
  });
});
