CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','operateur','lecteur')),
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS domaines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL UNIQUE,
  name_fr TEXT,
  ordre INTEGER NOT NULL,
  actif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS types_anomalie (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domaine_id INTEGER NOT NULL,
  name_ar TEXT NOT NULL,
  name_fr TEXT,
  ordre INTEGER NOT NULL,
  actif INTEGER NOT NULL DEFAULT 1,
  UNIQUE (domaine_id, name_ar),
  FOREIGN KEY (domaine_id) REFERENCES domaines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dairas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_fr TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  actif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS communes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daira_id INTEGER NOT NULL,
  name_fr TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  actif INTEGER NOT NULL DEFAULT 1,
  UNIQUE (daira_id, name_fr),
  FOREIGN KEY (daira_id) REFERENCES dairas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS epics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sigle TEXT,
  contact_nom TEXT,
  contact_tel TEXT,
  actif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS epic_domaines (
  epic_id INTEGER NOT NULL,
  domaine_id INTEGER NOT NULL,
  PRIMARY KEY (epic_id, domaine_id),
  FOREIGN KEY (epic_id) REFERENCES epics(id) ON DELETE CASCADE,
  FOREIGN KEY (domaine_id) REFERENCES domaines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  matricule TEXT,
  telephone TEXT,
  zone_daira_id INTEGER,
  actif INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (zone_daira_id) REFERENCES dairas(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS anomalies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  plateforme TEXT NOT NULL CHECK (plateforme IN ('facebook','instagram','tiktok','youtube','x','whatsapp','telegram','autre')),
  lien_url TEXT NOT NULL,
  lien_normalise TEXT,
  date_publication TEXT,
  date_signalement TEXT NOT NULL,
  saisi_par INTEGER,
  domaine_id INTEGER NOT NULL,
  type_id INTEGER NOT NULL,
  daira_id INTEGER NOT NULL,
  commune_id INTEGER NOT NULL,
  adresse_texte TEXT,
  lieu_dit TEXT,
  gps_lat REAL,
  gps_lng REAL,
  verification TEXT NOT NULL DEFAULT 'a_verifier' CHECK (verification IN ('a_verifier','confirmee','infirmee')),
  agent_id INTEGER,
  date_verification TEXT,
  statut TEXT NOT NULL DEFAULT 'non_traite' CHECK (statut IN ('non_traite','en_cours','traite')),
  epic_id INTEGER,
  date_intervention TEXT,
  date_traitement TEXT,
  priorite TEXT NOT NULL DEFAULT 'normale' CHECK (priorite IN ('normale','haute','urgente')),
  observations TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (saisi_par) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (domaine_id) REFERENCES domaines(id) ON DELETE RESTRICT,
  FOREIGN KEY (type_id) REFERENCES types_anomalie(id) ON DELETE RESTRICT,
  FOREIGN KEY (daira_id) REFERENCES dairas(id) ON DELETE RESTRICT,
  FOREIGN KEY (commune_id) REFERENCES communes(id) ON DELETE RESTRICT,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  FOREIGN KEY (epic_id) REFERENCES epics(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS anomalie_historique (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anomalie_id INTEGER NOT NULL,
  champ TEXT NOT NULL,
  ancienne_valeur TEXT,
  nouvelle_valeur TEXT,
  user_id INTEGER,
  at TEXT NOT NULL,
  FOREIGN KEY (anomalie_id) REFERENCES anomalies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pieces_jointes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anomalie_id INTEGER NOT NULL,
  chemin TEXT NOT NULL,
  nom_original TEXT NOT NULL,
  mime TEXT NOT NULL,
  taille INTEGER NOT NULL,
  user_id INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (anomalie_id) REFERENCES anomalies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rapports_hebdo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  semaine_debut TEXT NOT NULL,
  semaine_fin TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  genere_par INTEGER,
  at TEXT NOT NULL,
  FOREIGN KEY (genere_par) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entite TEXT,
  entite_id TEXT,
  details_json TEXT,
  ip TEXT,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parametres (
  cle TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anomalies_statut ON anomalies(statut);
CREATE INDEX IF NOT EXISTS idx_anomalies_date_signalement ON anomalies(date_signalement);
CREATE INDEX IF NOT EXISTS idx_anomalies_domaine_statut ON anomalies(domaine_id, statut);
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON anomalies(type_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_daira ON anomalies(daira_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_commune ON anomalies(commune_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_epic ON anomalies(epic_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_agent ON anomalies(agent_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_plateforme ON anomalies(plateforme);
CREATE INDEX IF NOT EXISTS idx_anomalies_verification ON anomalies(verification);
CREATE INDEX IF NOT EXISTS idx_anomalies_priorite ON anomalies(priorite);
