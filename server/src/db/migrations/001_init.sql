CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','operateur','lecteur')),
  actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK(must_change_password IN (0,1)),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE domaines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL UNIQUE,
  name_fr TEXT,
  ordre INTEGER NOT NULL,
  actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE types_anomalie (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domaine_id INTEGER NOT NULL REFERENCES domaines(id) ON DELETE RESTRICT,
  name_ar TEXT NOT NULL,
  name_fr TEXT,
  ordre INTEGER NOT NULL,
  actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(domaine_id, name_ar)
);

CREATE TABLE dairas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_fr TEXT NOT NULL UNIQUE,
  name_ar TEXT,
  actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE communes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daira_id INTEGER NOT NULL REFERENCES dairas(id) ON DELETE RESTRICT,
  name_fr TEXT NOT NULL,
  name_ar TEXT,
  actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(daira_id, name_fr)
);

CREATE TABLE epics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sigle TEXT,
  contact_nom TEXT,
  contact_tel TEXT,
  actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE epic_domaines (
  epic_id INTEGER NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  domaine_id INTEGER NOT NULL REFERENCES domaines(id) ON DELETE RESTRICT,
  PRIMARY KEY (epic_id, domaine_id)
);

CREATE TABLE agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  matricule TEXT UNIQUE,
  telephone TEXT,
  zone_daira_id INTEGER REFERENCES dairas(id) ON DELETE SET NULL,
  actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE anomalies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  plateforme TEXT NOT NULL CHECK(plateforme IN ('facebook','instagram','tiktok','youtube','x','whatsapp','telegram','autre')),
  lien_url TEXT NOT NULL CHECK(lien_url LIKE 'http://%' OR lien_url LIKE 'https://%'),
  lien_normalise TEXT NOT NULL,
  date_publication TEXT CHECK(date_publication IS NULL OR date_publication GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  date_signalement TEXT NOT NULL CHECK(date_signalement GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  domaine_id INTEGER NOT NULL REFERENCES domaines(id) ON DELETE RESTRICT,
  type_id INTEGER NOT NULL REFERENCES types_anomalie(id) ON DELETE RESTRICT,
  daira_id INTEGER NOT NULL REFERENCES dairas(id) ON DELETE RESTRICT,
  commune_id INTEGER NOT NULL REFERENCES communes(id) ON DELETE RESTRICT,
  adresse_texte TEXT,
  lieu_dit TEXT,
  gps_lat REAL CHECK(gps_lat IS NULL OR gps_lat BETWEEN -90 AND 90),
  gps_lng REAL CHECK(gps_lng IS NULL OR gps_lng BETWEEN -180 AND 180),
  verification TEXT NOT NULL DEFAULT 'a_verifier' CHECK(verification IN ('a_verifier','confirmee','infirmee')),
  agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  date_verification TEXT CHECK(date_verification IS NULL OR date_verification GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  statut TEXT NOT NULL DEFAULT 'non_traite' CHECK(statut IN ('non_traite','en_cours','traite')),
  epic_id INTEGER REFERENCES epics(id) ON DELETE SET NULL,
  intervenant_autre TEXT,
  date_intervention TEXT CHECK(date_intervention IS NULL OR date_intervention GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  date_traitement TEXT CHECK(date_traitement IS NULL OR date_traitement GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  priorite TEXT NOT NULL DEFAULT 'normale' CHECK(priorite IN ('normale','haute','urgente')),
  observations TEXT,
  search_norm TEXT NOT NULL DEFAULT '',
  saisi_par INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  deleted_at TEXT,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK((gps_lat IS NULL) = (gps_lng IS NULL)),
  CHECK(statut <> 'traite' OR date_traitement IS NOT NULL),
  CHECK(statut = 'traite' OR date_traitement IS NULL),
  CHECK(statut <> 'en_cours' OR date_intervention IS NOT NULL),
  CHECK(statut <> 'non_traite' OR date_intervention IS NULL),
  CHECK(statut = 'non_traite' OR epic_id IS NOT NULL OR (intervenant_autre IS NOT NULL AND intervenant_autre <> '')),
  CHECK(verification <> 'infirmee' OR statut = 'non_traite'),
  CHECK(date_intervention IS NULL OR date_intervention >= date_signalement),
  CHECK(date_traitement IS NULL OR date_traitement >= date_signalement),
  CHECK(date_traitement IS NULL OR date_intervention IS NULL OR date_traitement >= date_intervention)
);

CREATE TABLE anomalie_historique (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anomalie_id INTEGER NOT NULL REFERENCES anomalies(id) ON DELETE CASCADE,
  champ TEXT NOT NULL,
  ancienne_valeur TEXT,
  nouvelle_valeur TEXT,
  motif TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE pieces_jointes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anomalie_id INTEGER NOT NULL REFERENCES anomalies(id) ON DELETE CASCADE,
  chemin TEXT NOT NULL,
  nom_original TEXT,
  mime TEXT NOT NULL,
  taille INTEGER NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE rapports_hebdo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  semaine_debut TEXT NOT NULL,
  semaine_fin TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  genere_par INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(semaine_debut, version)
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  entite TEXT,
  entite_id TEXT,
  details_json TEXT,
  ip TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE parametres (
  cle TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);

CREATE TABLE compteurs (
  cle TEXT PRIMARY KEY,
  valeur INTEGER NOT NULL
);

CREATE INDEX idx_anomalies_statut ON anomalies(statut);
CREATE INDEX idx_anomalies_date_signalement ON anomalies(date_signalement);
CREATE INDEX idx_anomalies_date_traitement ON anomalies(date_traitement);
CREATE INDEX idx_anomalies_domaine_type ON anomalies(domaine_id, type_id);
CREATE INDEX idx_anomalies_daira_commune ON anomalies(daira_id, commune_id);
CREATE INDEX idx_anomalies_epic ON anomalies(epic_id);
CREATE INDEX idx_anomalies_agent ON anomalies(agent_id);
CREATE INDEX idx_anomalies_verification ON anomalies(verification);
CREATE INDEX idx_anomalies_lien ON anomalies(lien_normalise);
CREATE INDEX idx_anomalies_deleted ON anomalies(deleted_at);
CREATE INDEX idx_hist_anomalie_at ON anomalie_historique(anomalie_id, at);
CREATE INDEX idx_audit_at ON audit_log(at);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_types_domaine ON types_anomalie(domaine_id);
CREATE INDEX idx_communes_daira ON communes(daira_id);

INSERT INTO parametres(cle, valeur) VALUES
  ('nom_cellule', 'Cellule technique de numérisation'),
  ('week_start_day', '0'),
  ('delai_retard_jours', '7'),
  ('exiger_verification', '1'),
  ('tile_url', 'https://tile.openstreetmap.de/{z}/{x}/{y}.png'),
  ('backup_retention_days', '30'),
  ('gps_bbox', '36.40,2.50,36.95,3.40');
