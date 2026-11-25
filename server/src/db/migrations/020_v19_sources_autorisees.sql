-- V19 — liste blanche admin des domaines de sources externes (aucun appel réseau).
CREATE TABLE IF NOT EXISTS synthese_sources_autorisees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domaine TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK(length(domaine) BETWEEN 3 AND 200),
  ajoute_par INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
