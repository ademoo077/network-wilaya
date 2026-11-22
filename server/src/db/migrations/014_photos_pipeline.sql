-- 014_photos_pipeline.sql (V13)
-- Additif : aucune colonne existante n'est réécrite, aucune pièce n'est supprimée.

ALTER TABLE pieces_jointes ADD COLUMN largeur INTEGER CHECK(largeur IS NULL OR largeur > 0);
ALTER TABLE pieces_jointes ADD COLUMN hauteur INTEGER CHECK(hauteur IS NULL OR hauteur > 0);
ALTER TABLE pieces_jointes ADD COLUMN apercu_flou TEXT;
ALTER TABLE pieces_jointes ADD COLUMN hash TEXT;
ALTER TABLE pieces_jointes ADD COLUMN dossier_derive TEXT;

CREATE INDEX idx_pieces_hash ON pieces_jointes(hash);
CREATE INDEX idx_pieces_dossier_derive ON pieces_jointes(dossier_derive);
