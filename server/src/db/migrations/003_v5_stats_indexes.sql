-- Index de performance V5.5 : la corbeille est un petit sous-ensemble.
-- Sans index partiel, SQLite choisit idx_anomalies_deleted (toutes les lignes
-- ont deleted_at = NULL) au lieu des index de dates, ce qui transforme chaque
-- requête statistique en balayage complet.
DROP INDEX IF EXISTS idx_anomalies_deleted;
CREATE INDEX IF NOT EXISTS idx_anomalies_deleted
  ON anomalies(deleted_at) WHERE deleted_at IS NOT NULL;

-- Index partiels pour les étapes du flux (traitement, vérification, intervention).
CREATE INDEX IF NOT EXISTS idx_anomalies_traitement_actif
  ON anomalies(date_traitement) WHERE date_traitement IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_anomalies_verification_active
  ON anomalies(date_verification) WHERE date_verification IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_anomalies_intervention_active
  ON anomalies(date_intervention) WHERE date_intervention IS NOT NULL;
