-- V16 — index curseur pour le fil d'anomalies (date_signalement DESC, id DESC).
CREATE INDEX IF NOT EXISTS idx_anomalies_fil_date_id ON anomalies(date_signalement DESC, id DESC);
