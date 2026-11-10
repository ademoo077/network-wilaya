import { addDays, eachWeek, weekStart, weekEnd } from '@anm/shared';
import { buildFilters } from './anomalyQuery.js';
import {
  andClause, one, rows, round1, pct, median,
  statusAt, verifiedAt, confirmedAt, settingNumber,
} from './statsSql.js';

function stageDelay(db, base, values, fromCol, toCol) {
  const clause = andClause(base.clause, `${toCol} IS NOT NULL AND ${toCol} <= @D AND ${fromCol} IS NOT NULL`);
  const sql = `SELECT julianday(${toCol}) - julianday(${fromCol}) AS val FROM anomalies a ${clause}`;
  const moyenne = one(db, `SELECT AVG(val) AS v FROM (${sql})`, values).v;
  return { moyenne: round1(moyenne), mediane: round1(median(db, sql, values)) };
}

/**
 * Entonnoir 3.1. La cohorte inclut les infirmées pour que « vérifiées » et le
 * taux d'infirmation soient significatifs (les KPI restent sur la population V4).
 */
export function funnel(db, params, S, E) {
  const base = buildFilters({
    ...params, statut: undefined, verification: undefined,
    include_infirmees: true, from: S, to: E,
  });
  const values = { ...base.values, D: E };
  const r = one(db, `SELECT COUNT(*) AS recues,
    SUM(CASE WHEN ${verifiedAt()} THEN 1 ELSE 0 END) AS verifiees,
    SUM(CASE WHEN ${confirmedAt()} THEN 1 ELSE 0 END) AS confirmees,
    SUM(CASE WHEN ${confirmedAt()} AND ${statusAt()} IN ('en_cours', 'traite') THEN 1 ELSE 0 END) AS engagees,
    SUM(CASE WHEN ${confirmedAt()} AND ${statusAt()} = 'traite' THEN 1 ELSE 0 END) AS traitees,
    SUM(CASE WHEN a.verification = 'infirmee' AND (a.date_verification IS NULL OR a.date_verification <= @D) THEN 1 ELSE 0 END) AS infirmees
    FROM anomalies a ${base.clause}`, values);
  const n = {
    recues: r.recues || 0,
    verifiees: r.verifiees || 0,
    confirmees: r.confirmees || 0,
    engagees: r.engagees || 0,
    traitees: r.traitees || 0,
    infirmees: r.infirmees || 0,
  };
  return {
    etapes: { recues: n.recues, verifiees: n.verifiees, confirmees: n.confirmees, engagees: n.engagees, traitees: n.traitees },
    taux_passage: {
      verifiees: pct(n.verifiees, n.recues),
      confirmees: pct(n.confirmees, n.verifiees),
      engagees: pct(n.engagees, n.confirmees),
      traitees: pct(n.traitees, n.engagees),
      global: pct(n.traitees, n.recues),
    },
    infirmees: n.infirmees,
    taux_infirmation: pct(n.infirmees, n.verifiees),
    delais: {
      signalement_vers_verification: stageDelay(db, base, values, 'a.date_signalement', 'a.date_verification'),
      verification_vers_intervention: stageDelay(db, base, values, 'a.date_verification', 'a.date_intervention'),
      intervention_vers_traitement: stageDelay(db, base, values, 'a.date_intervention', 'a.date_traitement'),
    },
  };
}

/** Ancienneté du stock ouvert à la date E (3.4). */
export function stockAge(db, params, E) {
  const base = buildFilters({ ...params, statut: undefined, from: undefined, to: undefined });
  const clause = andClause(base.clause, "a.date_signalement <= @D AND (a.date_traitement IS NULL OR a.date_traitement > @D)");
  const values = { ...base.values, D: E, j7: addDays(E, -7), j14: addDays(E, -14), j30: addDays(E, -30) };
  const age = 'julianday(@D) - julianday(a.date_signalement)';
  const buckets = `SUM(CASE WHEN a.date_signalement >= @j7 THEN 1 ELSE 0 END) AS j0_7,
    SUM(CASE WHEN a.date_signalement < @j7 AND a.date_signalement >= @j14 THEN 1 ELSE 0 END) AS j8_14,
    SUM(CASE WHEN a.date_signalement < @j14 AND a.date_signalement >= @j30 THEN 1 ELSE 0 END) AS j15_30,
    SUM(CASE WHEN a.date_signalement < @j30 THEN 1 ELSE 0 END) AS j30p`;
  const global = { total: 0, j0_7: 0, j8_14: 0, j15_30: 0, j30p: 0 };
  const parPriorite = rows(db, `SELECT a.priorite AS priorite, COUNT(*) AS total, ${buckets}
    FROM anomalies a ${clause} GROUP BY a.priorite`, values);
  for (const row of parPriorite) {
    global.total += row.total || 0;
    global.j0_7 += row.j0_7 || 0;
    global.j8_14 += row.j8_14 || 0;
    global.j15_30 += row.j15_30 || 0;
    global.j30p += row.j30p || 0;
  }
  const oldest = one(db, `SELECT a.id, a.reference, a.priorite, a.date_signalement,
      CAST(${age} AS INTEGER) AS age_j
    FROM anomalies a ${clause} ORDER BY a.date_signalement ASC, a.id ASC LIMIT 1`, values);
  const tranche = (r) => ({
    total: r.total || 0,
    j0_7: r.j0_7 || 0, j8_14: r.j8_14 || 0, j15_30: r.j15_30 || 0, j30p: r.j30p || 0,
  });
  return {
    ...tranche(global),
    par_priorite: Object.fromEntries(
      ['urgente', 'haute', 'normale'].map((p) => [p, tranche(parPriorite.find((r) => r.priorite === p) || {})]),
    ),
    plus_ancienne: oldest.id ? oldest : null,
  };
}

/** Flux et tendance sur 12 semaines (3.5). */
export function trend(db, params, E, settings) {
  const wsd = Number(settings.week_start_day) || 0;
  const endWeek = weekEnd(E, wsd);
  const start = weekStart(addDays(endWeek, -7 * 11), wsd);
  const weeks = eachWeek(start, endWeek, wsd);
  const base = buildFilters({ ...params, statut: undefined, from: undefined, to: undefined });
  const stockBase = weeks.length
    ? one(db, `SELECT COUNT(*) AS c FROM anomalies a
      ${andClause(base.clause, `a.date_signalement <= @D AND ${statusAt()} <> 'traite'`)}`,
    { ...base.values, D: addDays(weeks[0].debut, -1) }).c || 0
    : 0;
  const serie = weeks.map((w) => {
    const recues = buildFilters({ ...params, statut: undefined, from: w.debut, to: w.fin });
    const traitees = buildFilters({
      ...params, statut: undefined, from: undefined, to: undefined,
      date_traitement_from: w.debut, date_traitement_to: w.fin,
    });
    return {
      debut: w.debut,
      fin: w.fin,
      recues: one(db, `SELECT COUNT(*) AS c FROM anomalies a ${recues.clause}`, recues.values).c,
      traitees: one(db, `SELECT COUNT(*) AS c FROM anomalies a ${traitees.clause}`, traitees.values).c,
    };
  });
  // Stock fin de semaine = stock initial + reçues − traitées (cumul).
  let running = stockBase;
  for (const week of serie) {
    running += week.recues - week.traitees;
    week.stock = running;
  }
  serie.forEach((w, index) => {
    const window = serie.slice(Math.max(0, index - 3), index + 1);
    w.mm4_recues = round1(window.reduce((sum, x) => sum + x.recues, 0) / window.length);
    w.mm4_traitees = round1(window.reduce((sum, x) => sum + x.traitees, 0) / window.length);
  });

  const last4 = serie.slice(-4);
  const longueur = last4.length || 1;
  const moyRecues = last4.reduce((sum, x) => sum + x.recues, 0) / longueur;
  const moyTraitees = last4.reduce((sum, x) => sum + x.traitees, 0) / longueur;
  const net = round1(moyTraitees - moyRecues);
  const stock = serie.length ? serie[serie.length - 1].stock : 0;
  const resorption = net > 0
    ? { possible: true, semaines: stock > 0 ? round1(stock / net) : 0, net_hebdo: net }
    : { possible: false, semaines: null, net_hebdo: net, texte: net === 0 ? 'Stock stable' : 'Stock en hausse' };

  const stocks = serie.slice(-3).map((w) => w.stock);
  const tendanceStock = stocks.length === 3 && stocks[2] > stocks[1] && stocks[1] > stocks[0] ? 'hausse'
    : stocks.length === 3 && stocks[2] < stocks[1] && stocks[1] < stocks[0] ? 'baisse' : 'stable';

  return {
    serie,
    moyenne_4s: { recues: round1(moyRecues), traitees: round1(moyTraitees), net },
    resorption,
    tendance_stock: tendanceStock,
    stock_actuel: stock,
  };
}

/** Jauge d'objectif de taux de traitement (3.6). */
export function objectif(db, params, S, E, settings) {
  const base = buildFilters({ ...params, statut: undefined, from: S, to: E });
  const r = one(db, `SELECT COUNT(*) AS total,
    SUM(CASE WHEN a.statut = 'traite' THEN 1 ELSE 0 END) AS traite
    FROM anomalies a ${base.clause}`, base.values);
  const cible = settingNumber(settings.objectif_taux_traitement, 80);
  const total = r.total || 0;
  const traite = r.traite || 0;
  const taux = total ? traite / total : null;
  const tauxPct = taux === null ? null : round1(taux * 100);
  const ecart = tauxPct === null ? null : round1(tauxPct - cible);
  const statut = tauxPct === null ? 'sans_donnees'
    : tauxPct >= cible ? 'atteint' : tauxPct >= cible - 5 ? 'proche' : 'en_retard';
  return { cible, taux, taux_pct: tauxPct, ecart_points: ecart, statut, total, traite };
}
