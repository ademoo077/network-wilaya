import { buildFilters } from './anomalyQuery.js';
import {
  andClause, one, rows, round1, pct, median, percentile,
  settingNumber, slaTargetCase, slaTargets,
} from './statsSql.js';

const DELAY = 'julianday(a.date_traitement) - julianday(a.date_signalement)';
const VERIFY_DELAY = 'julianday(a.date_verification) - julianday(a.date_signalement)';

function distribution(db, sql, values) {
  const r = one(db, `SELECT
    SUM(CASE WHEN val <= 2 THEN 1 ELSE 0 END) AS j0_2,
    SUM(CASE WHEN val > 2 AND val <= 7 THEN 1 ELSE 0 END) AS j3_7,
    SUM(CASE WHEN val > 7 AND val <= 14 THEN 1 ELSE 0 END) AS j8_14,
    SUM(CASE WHEN val > 14 AND val <= 30 THEN 1 ELSE 0 END) AS j15_30,
    SUM(CASE WHEN val > 30 THEN 1 ELSE 0 END) AS j30p,
    COUNT(*) AS total
    FROM (${sql})`, values);
  return {
    j0_2: r.j0_2 || 0,
    j3_7: r.j3_7 || 0,
    j8_14: r.j8_14 || 0,
    j15_30: r.j15_30 || 0,
    j30p: r.j30p || 0,
    total: r.total || 0,
  };
}

function delayBlock(db, clause, values) {
  const sql = `SELECT ${DELAY} AS val FROM anomalies a ${clause}`;
  return {
    total: one(db, `SELECT COUNT(*) AS c FROM (${sql})`, values).c || 0,
    moyenne: round1(one(db, `SELECT AVG(val) AS v FROM (${sql})`, values).v),
    mediane: round1(median(db, sql, values)),
    p90: round1(percentile(db, sql, values, 0.9)),
    distribution: distribution(db, sql, values),
  };
}

/** Traitées dont la date de traitement tombe dans [S,E]. */
function treatedScope(params, S, E) {
  return buildFilters({
    ...params, statut: undefined, from: undefined, to: undefined,
    date_traitement_from: S, date_traitement_to: E,
  });
}

export function delays(db, params, S, E, settings) {
  const base = treatedScope(params, S, E);
  const clause = andClause(base.clause, 'a.date_traitement IS NOT NULL');
  const global = delayBlock(db, clause, base.values);

  const parPriorite = {};
  for (const priorite of ['urgente', 'haute', 'normale']) {
    parPriorite[priorite] = delayBlock(
      db,
      andClause(base.clause, 'a.date_traitement IS NOT NULL AND a.priorite = @priorite'),
      { ...base.values, priorite },
    );
  }

  const targets = slaTargets(settings);
  const epicClause = andClause(clause, 'a.epic_id IS NOT NULL');
  const epicSql = `SELECT a.epic_id AS epic_id,
      ${DELAY} AS val,
      ${slaTargetCase()} AS cible,
      CASE WHEN ${DELAY} <= ${slaTargetCase()} THEN 1 ELSE 0 END AS sla_ok
    FROM anomalies a ${epicClause}`;
  const parEpic = rows(db, `WITH d AS MATERIALIZED (${epicSql}), r AS (
      SELECT epic_id, val, cible, sla_ok,
        ROW_NUMBER() OVER (PARTITION BY epic_id ORDER BY val) AS rn,
        COUNT(*) OVER (PARTITION BY epic_id) AS cnt
      FROM d)
    SELECT r.epic_id AS id, e.name AS label, r.cnt AS total,
      AVG(r.val) AS moyenne,
      AVG(CASE WHEN r.rn IN ((r.cnt + 1) / 2, (r.cnt + 2) / 2) THEN r.val END) AS mediane,
      MAX(CASE WHEN r.rn = CAST(0.9 * r.cnt + 0.999999 AS INTEGER) THEN r.val END) AS p90,
      AVG(r.cible) AS cible_moyenne,
      SUM(r.sla_ok) AS sla_ok
    FROM r JOIN epics e ON e.id = r.epic_id
    GROUP BY r.epic_id, e.name, r.cnt ORDER BY total DESC`, { ...base.values, ...targets })
    .map((r) => ({
      id: r.id,
      label: r.label,
      total: r.total,
      moyenne: round1(r.moyenne),
      mediane: round1(r.mediane),
      p90: round1(r.p90),
      cible_moyenne: round1(r.cible_moyenne),
      taux_sla: pct(r.sla_ok, r.total),
    }));

  return { global, par_priorite: parPriorite, par_epic: parEpic };
}

export function sla(db, params, S, E, settings) {
  const base = treatedScope(params, S, E);
  const clause = andClause(base.clause, 'a.date_traitement IS NOT NULL');
  const targets = slaTargets(settings);
  const r = one(db, `SELECT COUNT(*) AS total,
    SUM(CASE WHEN ${DELAY} <= ${slaTargetCase()} THEN 1 ELSE 0 END) AS ok,
    SUM(CASE WHEN a.priorite = 'urgente' THEN 1 ELSE 0 END) AS urgente_n,
    SUM(CASE WHEN a.priorite = 'urgente' AND ${DELAY} <= @slaUrgente THEN 1 ELSE 0 END) AS urgente_ok,
    SUM(CASE WHEN a.priorite = 'haute' THEN 1 ELSE 0 END) AS haute_n,
    SUM(CASE WHEN a.priorite = 'haute' AND ${DELAY} <= @slaHaute THEN 1 ELSE 0 END) AS haute_ok,
    SUM(CASE WHEN a.priorite = 'normale' THEN 1 ELSE 0 END) AS normale_n,
    SUM(CASE WHEN a.priorite = 'normale' AND ${DELAY} <= @slaNormale THEN 1 ELSE 0 END) AS normale_ok
    FROM anomalies a ${clause}`, { ...base.values, ...targets });

  const verifBase = buildFilters({
    ...params, statut: undefined, from: undefined, to: undefined,
    date_traitement_from: undefined, date_traitement_to: undefined,
    include_infirmees: true,
  });
  const verifClause = andClause(verifBase.clause, 'a.date_verification BETWEEN @S AND @E');
  const verifTarget = settingNumber(settings.delai_verification_cible_j, 2);
  const v = one(db, `SELECT COUNT(*) AS total,
    SUM(CASE WHEN ${VERIFY_DELAY} <= @target THEN 1 ELSE 0 END) AS ok
    FROM anomalies a ${verifClause}`, { ...verifBase.values, S, E, target: verifTarget });

  const block = (n, ok, cible) => ({
    total: n || 0, ok: ok || 0, dans_delais: pct(ok, n), cible_j: cible,
  });
  return {
    cibles: { urgente: targets.slaUrgente, haute: targets.slaHaute, normale: targets.slaNormale },
    global: { total: r.total || 0, ok: r.ok || 0, dans_delais: pct(r.ok, r.total) },
    par_priorite: {
      urgente: block(r.urgente_n, r.urgente_ok, targets.slaUrgente),
      haute: block(r.haute_n, r.haute_ok, targets.slaHaute),
      normale: block(r.normale_n, r.normale_ok, targets.slaNormale),
    },
    verification: {
      cible_j: verifTarget,
      total: v.total || 0,
      ok: v.ok || 0,
      dans_delais: pct(v.ok, v.total),
    },
  };
}
