-- V14 — réparation additive d'une base V13 où 013 a été enregistrée sans sa colonne.
-- Aucune migration appliquée n'est renumérotée ; la colonne existe déjà dans les bases correctement migrées.
-- @add-column-if-missing anomalies sans_photo_motif TEXT

-- Aucune autre modification : le motif reste facultatif et n'est jamais réécrit.
