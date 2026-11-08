ALTER TABLE anomalies ADD COLUMN gps_source TEXT
  CHECK(gps_source IS NULL OR gps_source IN ('manuel','lien_carte','lien_court','legende','exif','appareil','carte','voisinage'));
ALTER TABLE anomalies ADD COLUMN gps_precision_m INTEGER
  CHECK(gps_precision_m IS NULL OR gps_precision_m >= 0);
ALTER TABLE anomalies ADD COLUMN gps_verifiee INTEGER NOT NULL DEFAULT 0
  CHECK(gps_verifiee IN (0,1));
ALTER TABLE anomalies ADD COLUMN lie_a_id INTEGER REFERENCES anomalies(id) ON DELETE SET NULL;
ALTER TABLE anomalies ADD COLUMN contenu_type TEXT;
ALTER TABLE anomalies ADD COLUMN date_publication_estimee INTEGER NOT NULL DEFAULT 0
  CHECK(date_publication_estimee IN (0,1));
ALTER TABLE anomalies ADD COLUMN legende TEXT;
ALTER TABLE anomalies ADD COLUMN auteur_publication TEXT;

CREATE INDEX idx_anomalies_gps ON anomalies(gps_lat, gps_lng)
  WHERE gps_lat IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_anomalies_lie ON anomalies(lie_a_id);

CREATE TABLE groupes_domaines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_fr TEXT NOT NULL UNIQUE,
  name_ar TEXT,
  ordre INTEGER NOT NULL,
  actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

ALTER TABLE domaines ADD COLUMN groupe_id INTEGER REFERENCES groupes_domaines(id) ON DELETE SET NULL;
CREATE INDEX idx_domaines_groupe ON domaines(groupe_id);

CREATE TABLE limites_communes (
  commune_id INTEGER PRIMARY KEY REFERENCES communes(id) ON DELETE CASCADE,
  geojson TEXT NOT NULL,
  min_lat REAL NOT NULL,
  min_lng REAL NOT NULL,
  max_lat REAL NOT NULL,
  max_lng REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(min_lat <= max_lat),
  CHECK(min_lng <= max_lng)
);

CREATE TABLE liens_cache (
  url_normalise TEXT PRIMARY KEY,
  url_finale TEXT,
  meta_json TEXT,
  fetched_at TEXT NOT NULL
);

CREATE TABLE vues_sauvegardees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  page TEXT NOT NULL,
  filtres_json TEXT NOT NULL,
  partagee INTEGER NOT NULL DEFAULT 0 CHECK(partagee IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, page, nom)
);

CREATE TABLE boite_reception (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lien_url TEXT,
  texte TEXT,
  gps_lat REAL CHECK(gps_lat IS NULL OR gps_lat BETWEEN -90 AND 90),
  gps_lng REAL CHECK(gps_lng IS NULL OR gps_lng BETWEEN -180 AND 180),
  gps_source TEXT,
  auteur TEXT,
  date_message TEXT,
  origine TEXT NOT NULL CHECK(origine IN ('collage','whatsapp','manuel')),
  statut TEXT NOT NULL DEFAULT 'a_completer' CHECK(statut IN ('a_completer','converti','ignore')),
  anomalie_id INTEGER REFERENCES anomalies(id) ON DELETE SET NULL,
  saisi_par INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK((gps_lat IS NULL) = (gps_lng IS NULL))
);

CREATE INDEX idx_vues_user_page ON vues_sauvegardees(user_id, page);
CREATE INDEX idx_boite_reception_statut ON boite_reception(statut, created_at);

INSERT OR IGNORE INTO parametres(cle, valeur) VALUES
  ('rayon_doublon_m', '50'),
  ('objectif_taux_traitement', '80'),
  ('sla_urgente_j', '2'),
  ('sla_haute_j', '5'),
  ('sla_normale_j', '10'),
  ('delai_verification_cible_j', '2'),
  ('enrichissement_en_ligne', '0'),
  ('rapport_auto_fige', '1'),
  ('https_actif', '0');
