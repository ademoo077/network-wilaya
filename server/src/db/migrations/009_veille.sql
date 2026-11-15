-- V7 — Veille citoyenne. Migration additive : 004 à 008 sont déjà appliquées.

CREATE TABLE veille_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('facebook_page_geree','facebook_page_publique','capture_assistee','rss','google_news','youtube','instagram','telegram','import')),
  nom TEXT NOT NULL,
  config_chiffree TEXT,
  actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  frequence_min INTEGER NOT NULL DEFAULT 30 CHECK(frequence_min BETWEEN 5 AND 10080),
  derniere_execution TEXT,
  dernier_statut TEXT,
  dernier_message TEXT,
  curseur TEXT,
  quota_json TEXT,
  jeton_expire_le TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE veille_lexique (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  terme TEXT NOT NULL,
  terme_norm TEXT NOT NULL,
  langue TEXT NOT NULL CHECK(langue IN ('ar','fr','dz','mix')),
  role TEXT NOT NULL CHECK(role IN ('theme','urgence','exclusion')),
  groupe_id INTEGER REFERENCES groupes_domaines(id) ON DELETE SET NULL,
  domaine_id INTEGER REFERENCES domaines(id) ON DELETE SET NULL,
  type_id INTEGER REFERENCES types_anomalie(id) ON DELETE SET NULL,
  poids INTEGER NOT NULL CHECK(poids BETWEEN -5 AND 5),
  actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  origine TEXT NOT NULL DEFAULT 'seed' CHECK(origine IN ('seed','admin','appris')),
  vus INTEGER NOT NULL DEFAULT 0 CHECK(vus >= 0),
  acceptes INTEGER NOT NULL DEFAULT 0 CHECK(acceptes >= 0),
  rejetes INTEGER NOT NULL DEFAULT 0 CHECK(rejetes >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- L'unicité porte sur le terme saisi et son rattachement : le lexique fourni
-- contient des variantes normalisées identiques qui doivent toutes être conservées (270 termes).
CREATE UNIQUE INDEX uq_veille_lexique
  ON veille_lexique(terme, langue, role, IFNULL(groupe_id, 0), IFNULL(domaine_id, 0));
CREATE INDEX idx_veille_lexique_norm ON veille_lexique(terme_norm);

CREATE TABLE veille_alias_lieux (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alias TEXT NOT NULL,
  alias_norm TEXT NOT NULL,
  commune_id INTEGER REFERENCES communes(id) ON DELETE SET NULL,
  daira_id INTEGER REFERENCES dairas(id) ON DELETE SET NULL,
  origine TEXT NOT NULL DEFAULT 'admin' CHECK(origine IN ('admin','appris')),
  actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(alias_norm)
);

CREATE TABLE veille_jetons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  portee TEXT NOT NULL DEFAULT 'capture' CHECK(portee IN ('capture')),
  derniere_utilisation TEXT,
  revoque INTEGER NOT NULL DEFAULT 0 CHECK(revoque IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE veille_evenements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  groupe_id INTEGER REFERENCES groupes_domaines(id) ON DELETE SET NULL,
  commune_id INTEGER REFERENCES communes(id) ON DELETE SET NULL,
  debut TEXT NOT NULL,
  fin TEXT NOT NULL,
  nb_elements INTEGER NOT NULL DEFAULT 0,
  nb_sources INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL DEFAULT 0,
  priorite TEXT NOT NULL DEFAULT 'normale' CHECK(priorite IN ('normale','haute','urgente')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE veille_elements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES veille_sources(id) ON DELETE CASCADE,
  id_externe TEXT NOT NULL,
  url TEXT,
  url_normalise TEXT,
  page_nom TEXT,
  auteur_pseudo TEXT,
  texte TEXT NOT NULL,
  texte_norm TEXT NOT NULL,
  langue TEXT CHECK(langue IS NULL OR langue IN ('ar','fr','mix')),
  date_publication TEXT,
  collecte_le TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  type_media TEXT,
  metriques_json TEXT,
  gps_lat REAL CHECK(gps_lat IS NULL OR gps_lat BETWEEN -90 AND 90),
  gps_lng REAL CHECK(gps_lng IS NULL OR gps_lng BETWEEN -180 AND 180),
  simhash TEXT,
  groupe_doublon_id INTEGER REFERENCES veille_elements(id) ON DELETE SET NULL,
  evenement_id INTEGER REFERENCES veille_evenements(id) ON DELETE SET NULL,
  nb_sources INTEGER NOT NULL DEFAULT 1,
  score REAL NOT NULL DEFAULT 0,
  confiance TEXT CHECK(confiance IS NULL OR confiance IN ('haute','moyenne','basse')),
  priorite TEXT NOT NULL DEFAULT 'normale' CHECK(priorite IN ('normale','haute','urgente')),
  viralite REAL,
  statut TEXT NOT NULL DEFAULT 'nouveau' CHECK(statut IN ('nouveau','a_qualifier','retenu','rejete','doublon','ignore')),
  raison_rejet TEXT,
  anomalie_id INTEGER REFERENCES anomalies(id) ON DELETE SET NULL,
  traite_par INTEGER REFERENCES users(id) ON DELETE SET NULL,
  traite_le TEXT,
  expire_le TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(source_id, id_externe),
  CHECK((gps_lat IS NULL) = (gps_lng IS NULL))
);
CREATE INDEX idx_veille_elements_statut_date ON veille_elements(statut, date_publication);
CREATE INDEX idx_veille_elements_source ON veille_elements(source_id);
CREATE INDEX idx_veille_elements_doublon ON veille_elements(groupe_doublon_id);
CREATE INDEX idx_veille_elements_expire ON veille_elements(expire_le);
CREATE INDEX idx_veille_elements_simhash ON veille_elements(simhash);
CREATE INDEX idx_veille_elements_evenement ON veille_elements(evenement_id);

CREATE TABLE veille_correspondances (
  element_id INTEGER NOT NULL REFERENCES veille_elements(id) ON DELETE CASCADE,
  terme_id INTEGER NOT NULL REFERENCES veille_lexique(id) ON DELETE CASCADE,
  occurrences INTEGER NOT NULL CHECK(occurrences > 0),
  poids_total REAL NOT NULL,
  PRIMARY KEY (element_id, terme_id)
);

CREATE TABLE veille_suggestions (
  element_id INTEGER NOT NULL REFERENCES veille_elements(id) ON DELETE CASCADE,
  rang INTEGER NOT NULL,
  groupe_id INTEGER REFERENCES groupes_domaines(id) ON DELETE SET NULL,
  domaine_id INTEGER REFERENCES domaines(id) ON DELETE SET NULL,
  type_id INTEGER REFERENCES types_anomalie(id) ON DELETE SET NULL,
  score REAL NOT NULL,
  commune_id INTEGER REFERENCES communes(id) ON DELETE SET NULL,
  daira_id INTEGER REFERENCES dairas(id) ON DELETE SET NULL,
  priorite TEXT NOT NULL DEFAULT 'normale' CHECK(priorite IN ('normale','haute','urgente')),
  source_geo TEXT,
  raisons_json TEXT,
  PRIMARY KEY (element_id, rang)
);

CREATE TABLE veille_regles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'cooccurrence' CHECK(type IN ('cooccurrence')),
  termes_json TEXT NOT NULL CHECK(json_valid(termes_json)),
  fenetre_mots INTEGER NOT NULL DEFAULT 5 CHECK(fenetre_mots BETWEEN 1 AND 50),
  poids REAL NOT NULL DEFAULT 2,
  actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE veille_apprentissages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('terme_candidat','terme_retirer','alias')),
  terme TEXT NOT NULL,
  terme_norm TEXT NOT NULL,
  langue TEXT,
  groupe_id INTEGER REFERENCES groupes_domaines(id) ON DELETE SET NULL,
  commune_id INTEGER REFERENCES communes(id) ON DELETE SET NULL,
  occurrences INTEGER NOT NULL DEFAULT 0,
  precision REAL,
  statut TEXT NOT NULL DEFAULT 'propose' CHECK(statut IN ('propose','accepte','refuse')),
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE veille_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  element_id INTEGER REFERENCES veille_elements(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  avant_json TEXT,
  apres_json TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  annule_le TEXT,
  annule_par INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE veille_alertes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  regle TEXT NOT NULL,
  gravite TEXT NOT NULL CHECK(gravite IN ('info','avertissement','critique')),
  titre TEXT NOT NULL,
  details_json TEXT,
  lue INTEGER NOT NULL DEFAULT 0 CHECK(lue IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE veille_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL UNIQUE REFERENCES veille_sources(id) ON DELETE CASCADE,
  statut TEXT NOT NULL DEFAULT 'idle' CHECK(statut IN ('idle','running','success','error','backoff','disabled')),
  debut TEXT,
  fin TEXT,
  nb_collectes INTEGER NOT NULL DEFAULT 0,
  nb_nouveaux INTEGER NOT NULL DEFAULT 0,
  erreur_code TEXT,
  erreur_message TEXT,
  tentatives INTEGER NOT NULL DEFAULT 0,
  prochaine_execution TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  verrou_par TEXT,
  verrou_le TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_veille_jobs_due ON veille_jobs(statut, prochaine_execution);

CREATE TABLE veille_job_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES veille_sources(id) ON DELETE CASCADE,
  debut TEXT NOT NULL,
  fin TEXT,
  statut TEXT NOT NULL,
  nb_collectes INTEGER NOT NULL DEFAULT 0,
  nb_nouveaux INTEGER NOT NULL DEFAULT 0,
  erreur_code TEXT,
  erreur_message TEXT
);
CREATE INDEX idx_veille_job_runs_source ON veille_job_runs(source_id, debut);

ALTER TABLE anomalies ADD COLUMN veille_element_id INTEGER REFERENCES veille_elements(id) ON DELETE SET NULL;
CREATE INDEX idx_anomalies_veille ON anomalies(veille_element_id);

INSERT OR IGNORE INTO parametres(cle, valeur) VALUES
  ('veille_activee', '0'),
  ('veille_conservation_jours', '90'),
  ('veille_seuil_suggestion', '4'),
  ('veille_seuil_pertinent', '2'),
  ('veille_filtre_geo', 'source_ou_lieu'),
  ('veille_pseudonymiser_auteurs', '1'),
  ('veille_stocker_auteur', '0'),
  ('veille_fenetre_doublon_h', '72');
