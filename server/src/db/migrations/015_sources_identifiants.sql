-- V14 — identifiants de pages sociales et rattachement des anomalies.
-- Additif : aucune migration appliquée n'est réécrite ni renumérotée.
-- La table de référence est comptes_sociaux (V9), pas une table parallèle.

CREATE TABLE reseaux_identifiants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES comptes_sociaux(id) ON DELETE CASCADE,
  reseau TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('slug','id','handle','canal')),
  valeur TEXT NOT NULL,
  valeur_norm TEXT NOT NULL,
  cree_par INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(reseau, type, valeur_norm)
);
CREATE INDEX idx_reseaux_identifiants_source ON reseaux_identifiants(source_id);
CREATE INDEX idx_reseaux_identifiants_norm ON reseaux_identifiants(valeur_norm);

ALTER TABLE anomalies ADD COLUMN source_reseau_id INTEGER REFERENCES comptes_sociaux(id) ON DELETE SET NULL;
CREATE INDEX idx_anomalies_source_reseau ON anomalies(source_reseau_id);
CREATE INDEX idx_comptes_sociaux_search_norm ON comptes_sociaux(search_norm);
