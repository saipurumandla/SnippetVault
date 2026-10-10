-- key encrypted with MASTER_KEY, only last 4 chars go to the browser
CREATE TABLE IF NOT EXISTS ai_keys (
  user_id    INTEGER NOT NULL REFERENCES users(id),
  provider   TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai')),
  key_enc    TEXT NOT NULL,
  key_last4  TEXT NOT NULL,
  model      TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS ai_settings (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id),
  provider   TEXT NOT NULL DEFAULT 'ollama' CHECK (provider IN ('ollama', 'anthropic', 'openai')),
  updated_at TEXT NOT NULL
);

-- project_id null means personal snippets of granted_by
CREATE TABLE IF NOT EXISTS cloud_consent (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id),
  provider   TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai')),
  granted_by INTEGER NOT NULL REFERENCES users(id),
  granted_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS cloud_consent_project ON cloud_consent(project_id, provider) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cloud_consent_personal ON cloud_consent(granted_by, provider) WHERE project_id IS NULL;
