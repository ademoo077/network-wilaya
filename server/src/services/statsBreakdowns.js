import { splitPercent, addDays, weekStart, weekEnd } from '@anm/shared';
import { DIMENSIONS } from './stats.js';
import { buildFilters } from './anomalyQuery.js';
import {
  andClause, rows, round1, pct, slaTargetCase, slaTargets,
} from './statsSql.js';

const GROUP_DIM = {
  join: 'JOIN domaines gd ON gd.id = a.domaine_id JOIN groupes_domaines dim ON dim.id = gd.groupe_id',
  id: 'dim.id',
  ar: 'dim.name_ar',
  fr: 'dim.name_fr',
};

const DIMS = { ...DIMENSIONS, groupe: GROUP_DIM };
const DELAY = 'julianday(a.date_traitement) - julianday(a.date_signalement)';

function shape(list, dim) {
  return list.map((r) => {
    const [pNon, pCours, pTraite] = splitPercent([r.non_traite, r.en_cours, r.traite]);
    const labels = dim.simple ? (dim.labels[r.id] || [r.id, r.id]) : [r.label_ar, r.label_fr];
    return {
      id: r.id,
      label_ar: labels[0] || labels[1] || String(r.id),
      label_fr: labels[1] || labels[0] || String(r.id),
      total: r.total,
      non_traite: r.non_traite || 0,
      en_cours: r.en_cours || 0,
      traite: r.traite || 0,
      stock: (r.non_traite || 0) + (r.en_cours || 0),
      pct_non_traite: pNon,
      pct_en_cours: pCours,
      pct_traite: pTraite,
      delai_moyen: round1(r.delai_moyen),
      delai_median: round1(r.delai_median),
      taux_sla: pct(r.sla_ok, r.sla_n),
    };
  });
}

function agentMetrics(db, params, S, E) {
  const base = buildFilters({
    ...params, statut: undefined, from: undefined, to: undefined,
    date_traitement_from: undefined, date_traitement_to: undefined,
    include_infirmees: true,
  });
  const clause = andClause(base.clause, 'a.agent_id IS NOT NULL AND a.date_verification BETWEEN @S AND @E');
  return rows(db, `SELECT a.agent_id AS id, ag.full_name AS label,
      COUNT(*) AS verifications,
      SUM(CASE WHEN a.verification = 'confirmee' THEN 1 ELSE 0 END) AS confirmees,
      SUM(CASE WHEN a.verification = 'infirmee' THEN 1 ELSE 0 END) AS infirmees,
      AVG(julianday(a.date_verification) - julianday(a.date_signalement)) AS delai_verification
    FROM anomalies a JOIN agents ag ON ag.id = a.agent_id
    ${clause} GROUP BY a.agent_id`, { ...base.values, S, E })
    .map((r) => ({
      id: r.id,
      label: r.label,
      metriques_verification: {
        verifications: r.verifications || 0,
        confirmees: r.confirmees || 0,
        infirmees: r.infirmees || 0,
        pct_confirmees: pct(r.confirmees, r.verifications),
        pct_infirmees: pct(r.infirmees, r.verifications),
        delai_verification_moyen: round1(r.delai_verification),
      },
    }));
}

/** Ventilation 3.7 (statut actuel, cohérent avec le tableau de bord). */
export function ventilation(db, params, S, E, by, settings) {
  const dim = DIMS[by];
  if (!dim) return [];
  const base = buildFilters({ ...params, statut: undefined, from: S, to: E });
  const targets = slaTargets(settings);
  const idExpr = dim.simple || dim.id;
  const extraCols = dim.simple ? '' : `${dim.ar} AS label_ar, ${dim.fr} AS label_fr,`;
  const groupCols = dim.simple ? 'id' : 'id, label_ar, label_fr';
  const sql = `WITH b AS (
      SELECT ${idExpr} AS id, ${extraCols}
        a.statut AS statut,
        CASE WHEN a.date_traitement IS NOT NULL THEN ${DELAY} END AS delay,
        CASE WHEN a.date_traitement IS NOT NULL AND ${DELAY} <= ${slaTargetCase()} THEN 1 ELSE 0 END AS sla_ok,
        CASE WHEN a.date_traitement IS NOT NULL THEN 1 ELSE 0 END AS sla_n
      FROM anomalies a ${dim.join || ''} ${base.clause}
    ), agg AS (
      SELECT ${groupCols}, COUNT(*) AS total,
        SUM(CASE WHEN statut = 'non_traite' THEN 1 ELSE 0 END) AS non_traite,
        SUM(CASE WHEN statut = 'en_cours' THEN 1 ELSE 0 END) AS en_cours,
        SUM(CASE WHEN statut = 'traite' THEN 1 ELSE 0 END) AS traite,
        AVG(delay) AS delai_moyen,
        SUM(sla_ok) AS sla_ok, SUM(sla_n) AS sla_n
      FROM b GROUP BY ${groupCols}
    ), mid AS (
      SELECT id, AVG(delay) AS delai_median FROM (
        SELECT id, delay,
          ROW_NUMBER() OVER (PARTITION BY id ORDER BY delay) AS rn,
          COUNT(*) OVER (PARTITION BY id) AS cnt
        FROM b WHERE delay IS NOT NULL
      ) WHERE rn IN ((cnt + 1) / 2, (cnt + 2) / 2) GROUP BY id
    )
    SELECT agg.*, mid.delai_median FROM agg LEFT JOIN mid ON mid.id = agg.id
    ORDER BY agg.total DESC`;
  const list = shape(rows(db, sql, { ...base.values, ...targets }), dim);
  if (by !== 'agent') return list;

  const metrics = agentMetrics(db, params, S, E);
  const byId = new Map(metrics.map((m) => [String(m.id), m]));
  for (const row of list) row.metriques_verification = byId.get(String(row.id))?.metriques_verification || null;
  const present = new Set(list.map((r) => String(r.id)));
  for (const m of metrics) {
    if (present.has(String(m.id))) continue;
    list.push({
      id: m.id, label_ar: m.label, label_fr: m.label,
      total: 0, non_traite: 0, en_cours: 0, traite: 0, stock: 0,
      pct_non_traite: 0, pct_en_cours: 0, pct_traite: 0,
      delai_moyen: null, delai_median: null, taux_sla: null,
      metriques_verification: m.metriques_verification,
    });
  }
  return list;
}

/** Reçues par jour ISO (1 = lundi … 7 = dimanche). */
export function weekday(db, params, S, E) {
  const base = buildFilters({ ...params, statut: undefined, from: S, to: E });
  const list = rows(db, `SELECT ((CAST(strftime('%w', a.date_signalement) AS INTEGER) + 6) % 7) + 1 AS jour,
      COUNT(*) AS recues
    FROM anomalies a ${base.clause} GROUP BY jour`, base.values);
  const map = new Map(list.map((r) => [r.jour, r.recues]));
  return Array.from({ length: 7 }, (_, i) => ({ jour: i + 1, recues: map.get(i + 1) || 0 }));
}

/** Heatmap semaine × jour ISO sur 12 semaines. */
export function heatmap(db, params, E, settings, weeks = 12) {
  const wsd = Number(settings.week_start_day) || 0;
  const endWeek = weekEnd(E, wsd);
  const start = weekStart(addDays(endWeek, -7 * (weeks - 1)), wsd);
  const base = buildFilters({ ...params, statut: undefined, from: start, to: endWeek });
  const offset = `((CAST(strftime('%w', a.date_signalement) AS INTEGER) - @wsd + 7) % 7)`;
  const list = rows(db, `SELECT
      date(a.date_signalement, '-' || ${offset} || ' days') AS semaine,
      ((CAST(strftime('%w', a.date_signalement) AS INTEGER) + 6) % 7) + 1 AS jour,
      COUNT(*) AS recues
    FROM anomalies a ${base.clause} GROUP BY semaine, jour ORDER BY semaine, jour`,
  { ...base.values, wsd });
  return { debut: start, fin: endWeek, cellules: list };
}
