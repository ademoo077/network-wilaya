CREATE TABLE IF NOT EXISTS erreurs_client (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  stack TEXT,
  route TEXT,
  user_agent TEXT,
  version TEXT,
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_erreurs_client_created ON erreurs_client(created_at);
