CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  enc_public_key TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  owner_id    INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id INTEGER NOT NULL REFERENCES projects(id),
  user_id    INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS snippets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT NOT NULL,
  description     TEXT,
  code            TEXT NOT NULL,
  language        TEXT NOT NULL,
  visibility      TEXT NOT NULL DEFAULT 'private',
  encryption_mode TEXT NOT NULL DEFAULT 'standard',
  wrapped_key     TEXT,
  project_id      INTEGER REFERENCES projects(id),
  author_id       INTEGER NOT NULL REFERENCES users(id),
  copy_count      INTEGER NOT NULL DEFAULT 0,
  is_favourite    INTEGER NOT NULL DEFAULT 0,
  expires_at      TEXT,
  expired_at      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snippet_tags (
  snippet_id INTEGER NOT NULL REFERENCES snippets(id),
  tag        TEXT NOT NULL,
  PRIMARY KEY (snippet_id, tag)
);

CREATE TABLE IF NOT EXISTS snippet_versions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  snippet_id INTEGER NOT NULL REFERENCES snippets(id),
  code       TEXT NOT NULL,
  changed_at TEXT NOT NULL
);
