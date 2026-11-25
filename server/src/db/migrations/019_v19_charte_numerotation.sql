-- V19 — Cabinet du Wali : numérotation officielle monotone et charte vérrouillable.

CREATE TABLE IF NOT EXISTS synthese_numeros (
  annee TEXT PRIMARY KEY CHECK(length(annee) = 4),
  sequence INTEGER NOT NULL DEFAULT 0 CHECK(sequence >= 0),
  motif TEXT NOT NULL DEFAULT 'N° {SEQ}/CW/{AAAA}',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS synthese_charte (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  verrouille INTEGER NOT NULL DEFAULT 1 CHECK(verrouille IN (0,1)),
  palette_json TEXT NOT NULL CHECK(json_valid(palette_json)),
  polices_json TEXT NOT NULL CHECK(json_valid(polices_json)),
  motif TEXT NOT NULL DEFAULT 'N° {SEQ}/CW/{AAAA}',
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT OR IGNORE INTO synthese_charte(id, palette_json, polices_json)
VALUES (1,
  '["#1d4ed8","#2563eb","#60a5fa","#93c5fd","#1e3a8a"]',
  '["Inter","Cairo"]');
