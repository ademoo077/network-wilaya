import { DEFAULT_PARAMS, PUBLIC_PARAMS } from '@anm/shared';

export function getParams(db) {
  const rows = db.prepare('SELECT cle, valeur FROM parametres').all();
  const out = { ...DEFAULT_PARAMS };
  for (const row of rows) out[row.cle] = row.valeur;
  return out;
}

export function getNumberParam(db, key, fallback = 0) {
  const value = getParams(db)[key];
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function getBoolParam(db, key, fallback = false) {
  const value = getParams(db)[key];
  if (value === undefined) return fallback;
  return value === '1' || value === 'true';
}

export function setParams(db, values) {
  const stmt = db.prepare(`INSERT INTO parametres(cle, valeur) VALUES (?, ?)
    ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur`);
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(values)) stmt.run(key, String(value));
  });
  tx();
  return getParams(db);
}

export function publicParams(db) {
  const params = getParams(db);
  const numeric = new Set([
    'week_start_day', 'delai_retard_jours', 'rayon_doublon_m', 'objectif_taux_traitement',
    'sla_urgente_j', 'sla_haute_j', 'sla_normale_j', 'delai_verification_cible_j', 'https_actif',
    'enrichissement_en_ligne',
  ]);
  return Object.fromEntries(PUBLIC_PARAMS.map((key) => [key, numeric.has(key) ? Number(params[key]) : params[key]]));
}
