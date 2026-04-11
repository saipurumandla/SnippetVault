import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrate, MIGRATIONS_DIR } from '../src/migrate.ts';
import { openDb } from '../src/sqlite.ts';

function tmpDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-mig-'));
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql);
  return dir;
}

describe('migrate', () => {
  it('applies the real migrations once', () => {
    const db = openDb(':memory:');
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
    const db = openDb(':memory:');
    expect(migrate(db, dir)).toEqual(['001_a', '002_b']);
  });

  it('rolls back a broken migration', () => {
    const dir = tmpDir({
      '001_ok.sql': 'CREATE TABLE ok (id INTEGER);',
      '002_bad.sql': 'CREATE TABLE half (id INTEGER); THIS IS NOT SQL;',
    });
    const db = openDb(':memory:');
    expect(() => migrate(db, dir)).toThrow();
    const versions = db.prepare('SELECT version FROM schema_migrations').all().map(r => r.version);
    expect(versions).toEqual(['001_ok']);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'half'").get()).toBeUndefined();
  });

  it('is safe on a database made by the old schema.sql', () => {
    const db = openDb(':memory:');
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, '001_initial.sql'), 'utf8'));
    db.prepare("INSERT INTO users (email, password_hash, created_at) VALUES ('x@y.z', 'h', 'now')").run();
    expect(migrate(db)[0]).toBe('001_initial');
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(1);
  });

  it('002 moves old embeddings into sqlite-vec', () => {
    const only001 = tmpDir({ '001_initial.sql': fs.readFileSync(path.join(MIGRATIONS_DIR, '001_initial.sql'), 'utf8') });
    const db = openDb(':memory:');
    migrate(db, only001);
    db.prepare("INSERT INTO users (email, password_hash, created_at) VALUES ('e@x.y', 'h', 'now')").run();
    db.prepare("INSERT INTO snippets (title, code, language, author_id, created_at, updated_at) VALUES ('t', 'c', 'js', 1, 'now', 'now')").run();
    db.prepare("INSERT INTO rag_chunks (snippet_id, chunk_index, text, indexed_at) VALUES (1, 0, 't', 'now')").run();
    const vec = new Float32Array(384).fill(0.05);
    db.prepare("INSERT INTO rag_embeddings (chunk_id, embedding, model, dims) VALUES (1, ?, 'm', 384)").run(Buffer.from(vec.buffer));

    expect(migrate(db)[0]).toBe('002_sqlite_vec');
    expect(db.prepare('SELECT chunk_id FROM rag_vec').all()).toEqual([{ chunk_id: 1 }]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'rag_embeddings'").get()).toBeUndefined();
  });
});
