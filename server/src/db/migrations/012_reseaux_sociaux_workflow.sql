-- Phase V9 4 : corbeille, fusion et historique du répertoire social.
-- Additif : 001 à 011 sont déjà appliqués et ne sont jamais renumerotés.
ALTER TABLE comptes_sociaux ADD COLUMN deleted_at TEXT;
ALTER TABLE comptes_sociaux ADD COLUMN fusionne_dans INTEGER REFERENCES comptes_sociaux(id) ON DELETE SET NULL;
CREATE INDEX idx_comptes_sociaux_corbeille ON comptes_sociaux(deleted_at);
CREATE INDEX idx_comptes_sociaux_fusion ON comptes_sociaux(fusionne_dans);

CREATE TABLE comptes_sociaux_historique (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  compte_id INTEGER NOT NULL REFERENCES comptes_sociaux(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('CREATION','MODIFICATION','CONTROLE_MANUEL','FUSION','FUSION_RECU','CORBEILLE','RESTAURATION')),
  details_json TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_comptes_sociaux_historique_compte ON comptes_sociaux_historique(compte_id, at DESC);
