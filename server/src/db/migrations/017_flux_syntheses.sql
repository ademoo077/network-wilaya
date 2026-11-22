-- V15 — modèle de flux des synthèses.
-- 013 à 016 sont déjà appliquées : cette migration additive est volontairement 017.
-- La conversion JSON est faite par server/src/synthese/fluxMigration.js, qui
-- n'écrit que les définitions de modèles et jamais les snapshots d'éditions.
CREATE TABLE IF NOT EXISTS synthese_flux_migrations (
  modele_id INTEGER PRIMARY KEY REFERENCES syntheses_modeles(id) ON DELETE CASCADE,
  converti_le TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_synthese_flux_migrations_date ON synthese_flux_migrations(converti_le);
