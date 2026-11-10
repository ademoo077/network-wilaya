INSERT OR IGNORE INTO parametres(cle, valeur) VALUES ('resolution_liens', 'cartes');
INSERT OR IGNORE INTO parametres(cle, valeur) VALUES ('enrichissement_metadonnees', '0');
CREATE INDEX IF NOT EXISTS idx_anomalies_sans_gps ON anomalies(date_signalement)
  WHERE gps_lat IS NULL AND deleted_at IS NULL;
UPDATE erreurs_client SET user_id = NULL;
DELETE FROM erreurs_client WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days');
