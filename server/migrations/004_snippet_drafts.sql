CREATE TABLE IF NOT EXISTS snippet_drafts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  token_id    INTEGER REFERENCES access_tokens(id),
  source      TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  code        TEXT NOT NULL,
  language    TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',
  status      TEXT NOT NULL DEFAULT 'pending',
  snippet_id  INTEGER REFERENCES snippets(id),
  created_at  TEXT NOT NULL,
  decided_at  TEXT
);

CREATE INDEX IF NOT EXISTS snippet_drafts_user_status ON snippet_drafts(user_id, status);
