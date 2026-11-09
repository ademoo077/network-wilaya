import { buildFilters } from './anomalyQuery.js';

/** Ajoute une condition à une clause WHERE existante. */
export function andClause(clause, condition) {
  return clause ? `${clause} AND ${condition}` : `WHERE ${condition}`;
}

/** Statut d'une anomalie à la date @D (convention V4 § 5.2). */
export function statusAt(alias = 'a') {
  return `CASE
    WHEN ${alias}.date_traitement IS NOT NULL AND ${alias}.date_traitement <= @D THEN 'traite'
    WHEN ${alias}.date_intervention IS NOT NULL AND ${alias}.date_intervention <= @D THEN 'en_cours'
    ELSE 'non_traite' END`;
}

export function verifiedAt(alias = 'a') {
  return `${alias}.verification <> 'a_verifier' AND (${alias}.date_verification IS NULL OR ${alias}.date_verification <= @D)`;
}

export function confirmedAt(alias = 'a') {
  return `${alias}.verification = 'confirmee' AND (${alias}.date_verification IS NULL OR ${alias}.date_verification <= @D)`;
}

export function one(db, sql, values) {
  return db.prepare(sql).get(values) || {};
}

export function rows(db, sql, values) {
  return db.prepare(sql).all(values);
}

export function round1(value) {
  const n = Number(value);
  return value === null || value === undefined || Number.isNaN(n) ? null : Math.round(n * 10) / 10;
}

/** Pourcentage arrondi à 0,1 (null si le dénominateur est nul). */
export function pct(part, total) {
  return total ? round1(((part || 0) / total) * 100) : null;
}

/** Lit un paramètre numérique borné, avec valeur de repli si absent/invalide. */
export function settingNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Expression SQL de la cible SLA selon la priorité de la ligne. */
export function slaTargetCase(column = 'a.priorite') {
  return `CASE ${column} WHEN 'urgente' THEN @slaUrgente WHEN 'haute' THEN @slaHaute ELSE @slaNormale END`;
}

/** Paramètres nommés des trois cibles SLA à partir des réglages. */
export function slaTargets(settings) {
  return {
    slaUrgente: settingNumber(settings.sla_urgente_j, 2),
    slaHaute: settingNumber(settings.sla_haute_j, 5),
    slaNormale: settingNumber(settings.sla_normale_j, 10),
  };
}

/** Médiane exacte — moyenne des deux valeurs centrales quand l'effectif est pair. */
export function median(db, selectSql, values) {
  const row = one(db, `WITH d AS (${selectSql}), n AS (SELECT COUNT(*) AS c FROM d)
    SELECT (SELECT AVG(val) FROM (
      SELECT val FROM d ORDER BY val
      LIMIT 2 - (SELECT c % 2 FROM n)
      OFFSET (SELECT (c - 1) / 2 FROM n)
    )) AS v`, values);
  return row.v === null || row.v === undefined ? null : Number(row.v);
}

/** Percentile par rang le plus proche (0 < p <= 1). */
export function percentile(db, selectSql, values, p) {
  const row = one(db, `WITH d AS (${selectSql}), n AS (SELECT COUNT(*) AS c FROM d)
    SELECT (SELECT val FROM d ORDER BY val LIMIT 1 OFFSET
      MAX(0, CAST((${p} * (SELECT c FROM n)) + 0.999999 AS INTEGER) - 1)) AS v`, values);
  return row.v === null || row.v === undefined ? null : Number(row.v);
}

/** Filtre « cohorte reçue sur [S,E] » sans filtre de statut. */
export function cohort(params, S, E) {
  return buildFilters({ ...params, statut: undefined, from: S || undefined, to: E || undefined });
}

/** Filtre « hors période » (stock, récurrence, qualité). */
export function allTime(params) {
  return buildFilters({
    ...params, statut: undefined, from: undefined, to: undefined,
    date_traitement_from: undefined, date_traitement_to: undefined,
  });
}
