import {
  splitPercent, addDays, weekStart, weekEnd, todayAlgiers,
  previousPeriod, eachWeek, PLATEFORMES, PRIORITES,
} from '@anm/shared';
import { buildFilters } from './anomalyQuery.js';
import { getParams } from './settings.js';

const PLATFORM_LABELS = {
  facebook: ['فيسبوك', 'Facebook'], instagram: ['إنستغرام', 'Instagram'], tiktok: ['تيك توك', 'TikTok'],
  youtube: ['يوتيوب', 'YouTube'], x: ['إكس', 'X'], whatsapp: ['واتساب', 'WhatsApp'],
  telegram: ['تلغرام', 'Telegram'], autre: ['أخرى', 'Autre'],
};
const PRIORITY_LABELS = { normale: ['عادية', 'Normale'], haute: ['عالية', 'Haute'], urgente: ['عاجلة', 'Urgente'] };

export const DIMENSIONS = {
  domaine: { join: 'JOIN domaines dim ON dim.id = a.domaine_id', id: 'dim.id', ar: 'dim.name_ar', fr: 'dim.name_fr', list: 'SELECT id, name_ar, name_fr FROM domaines ORDER BY ordre', listId: 'id', listAr: 'name_ar', listFr: 'name_fr' },
  type: { join: 'JOIN types_anomalie dim ON dim.id = a.type_id', id: 'dim.id', ar: 'dim.name_ar', fr: 'dim.name_fr', list: 'SELECT id, name_ar, name_fr FROM types_anomalie ORDER BY ordre', listId: 'id', listAr: 'name_ar', listFr: 'name_fr' },
  daira: { join: 'JOIN dairas dim ON dim.id = a.daira_id', id: 'dim.id', ar: 'dim.name_ar', fr: 'dim.name_fr', list: 'SELECT id, name_ar, name_fr FROM dairas ORDER BY name_fr', listId: 'id', listAr: 'name_ar', listFr: 'name_fr' },
  commune: { join: 'JOIN communes dim ON dim.id = a.commune_id', id: 'dim.id', ar: 'dim.name_ar', fr: 'dim.name_fr', list: 'SELECT id, name_ar, name_fr FROM communes ORDER BY name_fr', listId: 'id', listAr: 'name_ar', listFr: 'name_fr' },
  epic: { join: 'JOIN epics dim ON dim.id = a.epic_id', id: 'dim.id', ar: 'dim.name', fr: 'dim.name', list: 'SELECT id, name AS name_ar, name AS name_fr FROM epics ORDER BY name', listId: 'id', listAr: 'name_ar', listFr: 'name_fr' },
  agent: { join: 'JOIN agents dim ON dim.id = a.agent_id', id: 'dim.id', ar: 'dim.full_name', fr: 'dim.full_name', list: 'SELECT id, full_name AS name_ar, full_name AS name_fr FROM agents ORDER BY full_name', listId: 'id', listAr: 'name_ar', listFr: 'name_fr' },
  plateforme: { simple: 'a.plateforme', labels: PLATFORM_LABELS, list: PLATEFORMES.map((p) => ({ id: p, ar: PLATFORM_LABELS[p][0], fr: PLATFORM_LABELS[p][1] })) },
  priorite: { simple: 'a.priorite', labels: PRIORITY_LABELS, list: PRIORITES.map((p) => ({ id: p, ar: PRIORITY_LABELS[p][0], fr: PRIORITY_LABELS[p][1] })) },
};

function scope(params, from, to) {
  return buildFilters({ ...params, statut: undefined, from, to, date_traitement_from: undefined, date_traitement_to: undefined });
}

function countByStatus(db, clause, values) {
  const rows = db.prepare(`SELECT a.statut AS statut, COUNT(*) AS n FROM anomalies a ${clause} GROUP BY a.statut`).all(values);
  const out = { non_traite: 0, en_cours: 0, traite: 0, total: 0 };
  for (const row of rows) {
    out[row.statut] = (out[row.statut] || 0) + row.n;
    out.total += row.n;
  }
  return out;
}

function pctBlock(counts) {
  const [pctNon, pctCours, pctTraite] = splitPercent([counts.non_traite, counts.en_cours, counts.traite]);
  return { ...counts, pct_non_traite: pctNon, pct_en_cours: pctCours, pct_traite: pctTraite };
}

function metrics(db, clause, values, delayParams = null) {
  const counts = pctBlock(countByStatus(db, clause, values));
  // Délai moyen : anomalies dont la date de traitement tombe dans la période (§ 5.1).
  const delayScope = delayParams ? buildFilters(delayParams) : { clause, values };
  const delay = db.prepare(`SELECT AVG(julianday(a.date_traitement) - julianday(a.date_signalement)) AS d
                            FROM anomalies a ${delayScope.clause} ${delayScope.clause ? 'AND' : 'WHERE'} a.date_traitement IS NOT NULL`)
    .get(delayScope.values).d;
  return {
    ...counts,
    taux_traitement: counts.total ? counts.traite / counts.total : null,
    delai_moyen_jours: delay === null ? null : Math.round(delay * 10) / 10,
    urgentes_ouvertes: 0,
    en_retard: 0,
  };
}

export function overview(db, params = {}) {
  const settings = getParams(db);
  const wsd = Number(settings.week_start_day) || 0;
  const retardDays = Number(settings.delai_retard_jours) || 7;
  const today = params.today || todayAlgiers();
  const all = params.all_periods === true || params.all_periods === '1';
  const from = all ? null : (params.from || weekStart(today, wsd));
  const to = all ? null : (params.to || weekEnd(today, wsd));
  const filters = { ...params, from, to };
  const current = scope(filters, from, to);
  const delayParams = {
    ...params, statut: undefined, from: undefined, to: undefined,
    date_traitement_from: from || undefined, date_traitement_to: to || undefined,
  };
  const currentMetrics = metrics(db, current.clause, current.values, delayParams);
  const allScope = buildFilters({ ...params, statut: undefined, from: undefined, to: undefined, date_traitement_from: undefined, date_traitement_to: undefined });
  const allClause = allScope.clause;
  const ug = db.prepare(`SELECT COUNT(*) AS c FROM anomalies a ${allClause} ${allClause ? 'AND' : 'WHERE'} a.priorite = 'urgente' AND a.statut <> 'traite'`).get(allScope.values).c;
  const cutoff = addDays(today, -retardDays);
  const late = db.prepare(`SELECT COUNT(*) AS c FROM anomalies a ${allClause} ${allClause ? 'AND' : 'WHERE'} a.statut <> 'traite' AND a.date_signalement < @cutoff`).get({ ...allScope.values, cutoff }).c;
  currentMetrics.urgentes_ouvertes = ug;
  currentMetrics.en_retard = late;
  const prev = all ? null : previousPeriod(from, to);
  let previousMetrics = null;
  if (prev) {
    const prevScope = scope(filters, prev.from, prev.to);
    const prevDelay = {
      ...params, statut: undefined, from: undefined, to: undefined,
      date_traitement_from: prev.from || undefined, date_traitement_to: prev.to || undefined,
    };
    previousMetrics = metrics(db, prevScope.clause, prevScope.values, prevDelay);
  }
  const rel = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);
  const points = (a, b) => (a === null || b === null ? null : Math.round((a - b) * 1000) / 10);
  return {
    periode: { from, to, all, week_start_day: wsd, aujourd_hui: today, delai_retard_jours: retardDays },
    cohorte: {
      total: currentMetrics.total,
      non_traite: currentMetrics.non_traite,
      en_cours: currentMetrics.en_cours,
      traite: currentMetrics.traite,
      pct_non_traite: currentMetrics.pct_non_traite,
      pct_en_cours: currentMetrics.pct_en_cours,
      pct_traite: currentMetrics.pct_traite,
    },
    taux_traitement: currentMetrics.taux_traitement,
    delai_moyen_jours: currentMetrics.delai_moyen_jours,
    urgentes_ouvertes: currentMetrics.urgentes_ouvertes,
    en_retard: currentMetrics.en_retard,
    previous: previousMetrics ? {
      periode: prev,
      total: previousMetrics.total,
      taux_traitement: previousMetrics.taux_traitement,
      delai_moyen_jours: previousMetrics.delai_moyen_jours,
    } : null,
    variations: previousMetrics ? {
      total: rel(currentMetrics.total, previousMetrics.total),
      non_traite: rel(currentMetrics.non_traite, previousMetrics.non_traite),
      en_cours: rel(currentMetrics.en_cours, previousMetrics.en_cours),
      traite: rel(currentMetrics.traite, previousMetrics.traite),
      taux_traitement: points(currentMetrics.taux_traitement, previousMetrics.taux_traitement),
      delai_moyen_jours: currentMetrics.delai_moyen_jours === null || previousMetrics.delai_moyen_jours === null
        ? null : Math.round((currentMetrics.delai_moyen_jours - previousMetrics.delai_moyen_jours) * 10) / 10,
    } : null,
  };
}

function groupRows(db, by, params) {
  const dim = DIMENSIONS[by];
  if (!dim) return [];
  const scopeFilters = buildFilters({ ...params, statut: undefined });
  const agg = `COUNT(*) AS total,
    SUM(CASE WHEN a.statut = 'non_traite' THEN 1 ELSE 0 END) AS non_traite,
    SUM(CASE WHEN a.statut = 'en_cours' THEN 1 ELSE 0 END) AS en_cours,
    SUM(CASE WHEN a.statut = 'traite' THEN 1 ELSE 0 END) AS traite`;
  if (dim.simple) {
    const rows = db.prepare(`SELECT ${dim.simple} AS id, ${agg} FROM anomalies a
                             ${scopeFilters.clause} GROUP BY ${dim.simple} ORDER BY total DESC`).all(scopeFilters.values);
    return rows.map((r) => {
      const labels = dim.labels[r.id] || [r.id, r.id];
      return { ...r, label_ar: labels[0], label_fr: labels[1] };
    });
  }
  const rows = db.prepare(`SELECT ${dim.id} AS id, ${dim.ar} AS label_ar, ${dim.fr} AS label_fr, ${agg}
                           FROM anomalies a ${dim.join} ${scopeFilters.clause}
                           GROUP BY ${dim.id} ORDER BY total DESC`).all(scopeFilters.values);
  if (params.include_empty) {
    const existing = new Set(rows.map((r) => String(r.id)));
    const all = db.prepare(dim.list).all();
    for (const row of all) {
      if (!existing.has(String(row[dim.listId]))) {
        rows.push({ id: row[dim.listId], label_ar: row[dim.listAr], label_fr: row[dim.listFr], total: 0, non_traite: 0, en_cours: 0, traite: 0 });
      }
    }
  }
  return rows;
}

export function groupStats(db, by, params = {}) {
  const rows = groupRows(db, by, params);
  const totalsRaw = rows.reduce((acc, r) => ({
    total: acc.total + r.total, non_traite: acc.non_traite + r.non_traite,
    en_cours: acc.en_cours + r.en_cours, traite: acc.traite + r.traite,
  }), { total: 0, non_traite: 0, en_cours: 0, traite: 0 });
  const totalPcts = splitPercent([totalsRaw.non_traite, totalsRaw.en_cours, totalsRaw.traite]);
  const totals = {
    ...totalsRaw,
    pct_non_traite: totalPcts[0], pct_en_cours: totalPcts[1], pct_traite: totalPcts[2],
  };
  return {
    by,
    rows: rows.map((r) => {
      const [a, b, c] = splitPercent([r.non_traite, r.en_cours, r.traite]);
      return { ...r, pct_non_traite: a, pct_en_cours: b, pct_traite: c };
    }).sort((x, y) => y.total - x.total),
    totals,
  };
}

export function timeline(db, params = {}) {
  const settings = getParams(db);
  const wsd = Number(settings.week_start_day) || 0;
  const today = params.today || todayAlgiers();
  const end = params.to || today;
  const start = params.from || addDays(weekStart(end, wsd), -7 * 11);
  const weeks = eachWeek(start, end, wsd);
  const out = [];
  for (const week of weeks) {
    const recues = buildFilters({ ...params, statut: undefined, from: week.debut, to: week.fin });
    const traitees = buildFilters({ ...params, statut: undefined, from: undefined, to: undefined, date_traitement_from: week.debut, date_traitement_to: week.fin });
    out.push({
      debut: week.debut,
      fin: week.fin,
      recues: db.prepare(`SELECT COUNT(*) AS c FROM anomalies a ${recues.clause}`).get(recues.values).c,
      traitees: db.prepare(`SELECT COUNT(*) AS c FROM anomalies a ${traitees.clause}`).get(traitees.values).c,
    });
  }
  return out;
}

export function activite(db, limit = 10) {
  return db.prepare(`SELECT h.id, h.anomalie_id, h.champ, h.ancienne_valeur, h.nouvelle_valeur, h.motif, h.at,
                            a.reference, u.full_name AS user_nom, u.username AS user_username
                     FROM anomalie_historique h
                     JOIN anomalies a ON a.id = h.anomalie_id AND a.deleted_at IS NULL
                     LEFT JOIN users u ON u.id = h.user_id
                     ORDER BY h.at DESC, h.id DESC LIMIT ?`).all(limit);
}

export { pctBlock, countByStatus, scope, metrics };
