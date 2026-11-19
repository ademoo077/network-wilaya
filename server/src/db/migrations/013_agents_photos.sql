-- 013_agents_photos.sql (V12)
-- Migration additive : affectation automatique des agents par daïra + photos avant/après.
-- Ne renumérote pas une migration appliquée (dernière appliquée : 012).

-- Affectation des agents par daïra (un seul titulaire actif par daïra grâce à l'index partiel).
CREATE TABLE IF NOT EXISTS affectations_agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daira_id INTEGER NOT NULL REFERENCES dairas(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'titulaire' CHECK(role IN ('titulaire','suppleant')),
  du TEXT CHECK(du IS NULL OR du GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  actif INTEGER NOT NULL DEFAULT 1 CHECK(actif IN (0,1)),
  motif TEXT,
  cree_par INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX idx_affectations_titulaire_unique
  ON affectations_agents(daira_id) WHERE role = 'titulaire' AND actif = 1;
CREATE INDEX idx_affectations_agent ON affectations_agents(agent_id);
CREATE INDEX idx_affectations_daira ON affectations_agents(daira_id, actif);

-- Traçabilité de l'affectation sur chaque anomalie.
ALTER TABLE anomalies ADD COLUMN agent_source TEXT CHECK(agent_source IN ('auto','manuel','import'));
ALTER TABLE anomalies ADD COLUMN agent_affecte_le TEXT;
ALTER TABLE anomalies ADD COLUMN agent_motif TEXT;
-- Les affectations historiques étaient manuelles : on les marque 'manuel' pour ne jamais les écraser.
UPDATE anomalies SET agent_source = 'manuel' WHERE agent_id IS NOT NULL;

-- Photos avant/après sur les pièces jointes.
ALTER TABLE pieces_jointes ADD COLUMN role TEXT NOT NULL DEFAULT 'autre' CHECK(role IN ('avant','apres','autre'));
ALTER TABLE pieces_jointes ADD COLUMN principale INTEGER NOT NULL DEFAULT 0 CHECK(principale IN (0,1));
ALTER TABLE pieces_jointes ADD COLUMN legende TEXT;
ALTER TABLE pieces_jointes ADD COLUMN prise_le TEXT CHECK(prise_le IS NULL OR prise_le GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]');
ALTER TABLE pieces_jointes ADD COLUMN gps_lat REAL CHECK(gps_lat IS NULL OR gps_lat BETWEEN -90 AND 90);
ALTER TABLE pieces_jointes ADD COLUMN gps_lng REAL CHECK(gps_lng IS NULL OR gps_lng BETWEEN -180 AND 180);
ALTER TABLE pieces_jointes ADD COLUMN miniature_chemin TEXT;

-- V12 : dispense de photo après au passage « traité », avec motif obligatoire.
ALTER TABLE anomalies ADD COLUMN sans_photo_motif TEXT;
INSERT INTO parametres(cle, valeur) VALUES ('photo_apres_obligatoire', '1')
  ON CONFLICT(cle) DO NOTHING;

-- Liaison compte utilisateur <-> agent (pour « Mes anomalies »).
ALTER TABLE users ADD COLUMN agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL;

-- Index de performance.
CREATE INDEX idx_anomalies_agent_source ON anomalies(agent_source);
CREATE INDEX idx_anomalies_agent_affecte ON anomalies(agent_affecte_le);
CREATE INDEX idx_anomalies_agent_id ON anomalies(agent_id);
CREATE INDEX idx_pieces_jointes_role_principale ON pieces_jointes(role, principale);
CREATE INDEX idx_pieces_jointes_anomalie_role ON pieces_jointes(anomalie_id, role);

-- V12 : la vérification est masquée de l'interface ; le paramètre est fixé à 0.
UPDATE parametres SET valeur = '0' WHERE cle = 'exiger_verification';

-- Aucun nouveau trigger : anomalies et pieces_jointes ont déjà trg_data_version_*.
