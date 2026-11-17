-- Répertoire manuel des pages et profils publics. Aucun accès réseau ni semis implicite.
CREATE TABLE comptes_sociaux (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  nom TEXT NOT NULL DEFAULT '',
  lien_url TEXT NOT NULL CHECK(lien_url LIKE 'http://%' OR lien_url LIKE 'https://%'),
  lien_normalise TEXT NOT NULL UNIQUE,
  plateforme TEXT NOT NULL CHECK(plateforme IN ('facebook','instagram','tiktok','youtube','x','whatsapp','telegram','autre')),
  categorie TEXT NOT NULL CHECK(categorie IN ('page','profil','groupe','chaine','autre')),
  daira_id INTEGER REFERENCES dairas(id) ON DELETE SET NULL,
  commune_id INTEGER REFERENCES communes(id) ON DELETE SET NULL,
  ca_libelle TEXT NOT NULL DEFAULT '',
  commune_libelle TEXT NOT NULL DEFAULT '',
  observations TEXT NOT NULL DEFAULT '',
  verification TEXT NOT NULL DEFAULT 'a_verifier' CHECK(verification IN ('a_verifier','verifie')),
  actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  origine TEXT NOT NULL DEFAULT 'manuel' CHECK(origine IN ('manuel','excel')),
  fichier_source TEXT,
  feuille_source TEXT,
  ligne_source INTEGER,
  colonne_source TEXT,
  nom_source TEXT,
  ca_source TEXT,
  commune_source TEXT,
  search_norm TEXT NOT NULL DEFAULT '',
  cree_par INTEGER REFERENCES users(id) ON DELETE SET NULL,
  modifie_par INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_comptes_sociaux_reseau_type ON comptes_sociaux(plateforme, categorie);
CREATE INDEX idx_comptes_sociaux_territoire ON comptes_sociaux(daira_id, commune_id);
CREATE INDEX idx_comptes_sociaux_etat ON comptes_sociaux(actif, verification);
