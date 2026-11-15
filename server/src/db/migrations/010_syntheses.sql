-- V8 — Laboratoire de synthèses. Migration additive : 001 à 009 sont déjà appliquées.
-- Tables du § 13 de docs/SPEC_V8.md + version de données pour le cache du moteur.

CREATE TABLE syntheses_modeles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  description TEXT,
  proprietaire_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  portee TEXT NOT NULL DEFAULT 'prive' CHECK(portee IN ('prive','equipe','systeme')),
  definition_json TEXT NOT NULL CHECK(json_valid(definition_json)),
  schema_version INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  cle_systeme TEXT UNIQUE,
  archive INTEGER NOT NULL DEFAULT 0 CHECK(archive IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_syntheses_modeles_proprietaire ON syntheses_modeles(proprietaire_id, archive);
CREATE INDEX idx_syntheses_modeles_portee ON syntheses_modeles(portee, archive);

CREATE TABLE syntheses_editions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  modele_id INTEGER NOT NULL REFERENCES syntheses_modeles(id) ON DELETE CASCADE,
  periode_debut TEXT NOT NULL CHECK(periode_debut GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  periode_fin TEXT NOT NULL CHECK(periode_fin GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  parametres_json TEXT NOT NULL CHECK(json_valid(parametres_json)),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK(statut IN ('brouillon','relu','valide','fige')),
  snapshot_json TEXT CHECK(snapshot_json IS NULL OR json_valid(snapshot_json)),
  catalogue_version TEXT,
  data_version INTEGER,
  textes_edition_json TEXT CHECK(textes_edition_json IS NULL OR json_valid(textes_edition_json)),
  genere_par INTEGER REFERENCES users(id) ON DELETE SET NULL,
  figee_le TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(modele_id, periode_debut, periode_fin, version),
  CHECK(periode_fin >= periode_debut)
);
CREATE INDEX idx_syntheses_editions_modele ON syntheses_editions(modele_id, periode_debut DESC);
CREATE INDEX idx_syntheses_editions_statut ON syntheses_editions(statut, figee_le);

CREATE TABLE syntheses_commentaires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edition_id INTEGER NOT NULL REFERENCES syntheses_editions(id) ON DELETE CASCADE,
  bloc_id TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  texte TEXT NOT NULL,
  position_json TEXT CHECK(position_json IS NULL OR json_valid(position_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_syntheses_commentaires_edition ON syntheses_commentaires(edition_id);

CREATE TABLE syntheses_planifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  modele_id INTEGER NOT NULL REFERENCES syntheses_modeles(id) ON DELETE CASCADE,
  frequence TEXT NOT NULL DEFAULT 'hebdomadaire' CHECK(frequence IN ('quotidienne','hebdomadaire','mensuelle')),
  jour INTEGER CHECK(jour IS NULL OR jour BETWEEN 0 AND 6),
  heure INTEGER NOT NULL DEFAULT 6 CHECK(heure BETWEEN 0 AND 23),
  periode TEXT NOT NULL DEFAULT 'semaine' CHECK(periode IN ('jour','semaine','mois')),
  auto_fige INTEGER NOT NULL DEFAULT 1 CHECK(auto_fige IN (0,1)),
  actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  derniere_execution TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_syntheses_planifications_due ON syntheses_planifications(actif, derniere_execution);

CREATE TABLE syntheses_partages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edition_id INTEGER NOT NULL REFERENCES syntheses_editions(id) ON DELETE CASCADE,
  jeton_hash TEXT NOT NULL UNIQUE,
  expire_le TEXT,
  revoque INTEGER NOT NULL DEFAULT 0 CHECK(revoque IN (0,1)),
  cree_par INTEGER REFERENCES users(id) ON DELETE SET NULL,
  dernier_acces TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_syntheses_partages_edition ON syntheses_partages(edition_id);

CREATE TABLE syntheses_requetes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  spec_json TEXT NOT NULL CHECK(json_valid(spec_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_syntheses_requetes_user ON syntheses_requetes(user_id);

CREATE TABLE syntheses_blocs_bibliotheque (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  bloc_json TEXT NOT NULL CHECK(json_valid(bloc_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_syntheses_blocs_user ON syntheses_blocs_bibliotheque(user_id);

CREATE TABLE objectifs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mesure TEXT NOT NULL,
  perimetre_json TEXT CHECK(perimetre_json IS NULL OR json_valid(perimetre_json)),
  cible REAL NOT NULL,
  sens TEXT NOT NULL DEFAULT 'hausse' CHECK(sens IN ('hausse','baisse')),
  valide_du TEXT CHECK(valide_du IS NULL OR valide_du GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  valide_au TEXT CHECK(valide_au IS NULL OR valide_au GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Version de données : incrémentée à chaque écriture pour invalider le cache.
CREATE TABLE data_version (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO data_version(id, version) VALUES (1, 1);

CREATE TRIGGER trg_data_version_anomalies_insert AFTER INSERT ON anomalies BEGIN
  UPDATE data_version SET version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_anomalies_update AFTER UPDATE ON anomalies BEGIN
  UPDATE data_version SET version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_anomalies_delete AFTER DELETE ON anomalies BEGIN
  UPDATE data_version SET version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 1;
END;

CREATE TRIGGER trg_data_version_domaines AFTER INSERT ON domaines BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_domaines_u AFTER UPDATE ON domaines BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_domaines_d AFTER DELETE ON domaines BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_types AFTER INSERT ON types_anomalie BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_types_u AFTER UPDATE ON types_anomalie BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_types_d AFTER DELETE ON types_anomalie BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_dairas AFTER INSERT ON dairas BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_dairas_u AFTER UPDATE ON dairas BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_dairas_d AFTER DELETE ON dairas BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_communes AFTER INSERT ON communes BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_communes_u AFTER UPDATE ON communes BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_communes_d AFTER DELETE ON communes BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_epics AFTER INSERT ON epics BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_epics_u AFTER UPDATE ON epics BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_epics_d AFTER DELETE ON epics BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_agents AFTER INSERT ON agents BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_agents_u AFTER UPDATE ON agents BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_agents_d AFTER DELETE ON agents BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_pieces AFTER INSERT ON pieces_jointes BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_pieces_u AFTER UPDATE ON pieces_jointes BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_data_version_pieces_d AFTER DELETE ON pieces_jointes BEGIN
  UPDATE data_version SET version = version + 1 WHERE id = 1;
END;

-- Immutabilité d’une édition figée et des modèles système.
CREATE TRIGGER trg_syntheses_edition_figee_update BEFORE UPDATE ON syntheses_editions
WHEN OLD.statut = 'fige'
BEGIN SELECT RAISE(ABORT, 'Édition figée immuable'); END;
CREATE TRIGGER trg_syntheses_edition_figee_delete BEFORE DELETE ON syntheses_editions
WHEN OLD.statut = 'fige'
BEGIN SELECT RAISE(ABORT, 'Édition figée immuable'); END;
CREATE TRIGGER trg_syntheses_modele_systeme_delete BEFORE DELETE ON syntheses_modeles
WHEN OLD.portee = 'systeme'
BEGIN SELECT RAISE(ABORT, 'Modèle système non supprimable'); END;
