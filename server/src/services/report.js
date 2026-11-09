import ExcelJS from 'exceljs';
import {
  addDays, weekStart, todayAlgiers, formatDate, splitPercent, percent,
} from '@anm/shared';
import { buildFilters } from './anomalyQuery.js';
import { getParams } from './settings.js';
import { DIMENSIONS } from './stats.js';
import { detailStats } from './statsDetail.js';
import { neutralizeFormula } from './export.js';

const STATUS_CASE = (alias = 'a') => `CASE
  WHEN ${alias}.date_traitement IS NOT NULL AND ${alias}.date_traitement <= @D THEN 'traite'
  WHEN ${alias}.date_intervention IS NOT NULL AND ${alias}.date_intervention <= @D THEN 'en_cours'
  ELSE 'non_traite' END`;

function andClause(clause, condition) {
  return `${clause ? `${clause} AND` : 'WHERE'} ${condition}`;
}

function statusCounts(db, base, start, end, D) {
  const clause = andClause(base.clause, 'a.date_signalement BETWEEN @S AND @E');
  const rows = db.prepare(`SELECT ${STATUS_CASE()} AS statut, COUNT(*) AS n
                           FROM anomalies a ${clause} GROUP BY statut`)
    .all({ ...base.values, S: start, E: end, D });
  const out = { non_traite: 0, en_cours: 0, traite: 0, total: 0 };
  for (const row of rows) { out[row.statut] = row.n; out.total += row.n; }
  return out;
}

function countWhere(db, base, condition, params = {}) {
  const clause = andClause(base.clause, condition);
  return db.prepare(`SELECT COUNT(*) AS c FROM anomalies a ${clause}`).get({ ...base.values, ...params }).c;
}

function avgWhere(db, base, condition, params = {}) {
  const clause = andClause(base.clause, condition);
  const value = db.prepare(`SELECT AVG(julianday(a.date_traitement) - julianday(a.date_signalement)) AS d
                            FROM anomalies a ${clause}`).get({ ...base.values, ...params }).d;
  return value === null ? null : Math.round(value * 10) / 10;
}

function weekMetrics(db, base, start, end, retardDays) {
  const statuses = statusCounts(db, base, start, end, end);
  const traitees = countWhere(db, base, 'a.date_traitement BETWEEN @S AND @E', { S: start, E: end });
  const stockFin = countWhere(db, base, 'a.date_signalement <= @E AND ' + STATUS_CASE() + " <> 'traite'", { E: end, D: end });
  const stockDebut = countWhere(db, base, 'a.date_signalement <= @D0 AND ' + STATUS_CASE() + " <> 'traite'", { D0: addDays(start, -1), D: addDays(start, -1) });
  const recuCumule = countWhere(db, base, 'a.date_signalement <= @E', { E: end });
  const traiteesCumulees = countWhere(db, base, 'a.date_traitement <= @E', { E: end });
  const urgentes = countWhere(db, base, 'a.priorite = \'urgente\' AND a.date_signalement <= @E AND ' + STATUS_CASE() + " <> 'traite'", { E: end, D: end });
  const cutoff = addDays(end, -retardDays);
  const retard = countWhere(db, base, 'a.date_signalement < @cutoff AND a.date_signalement <= @E AND ' + STATUS_CASE() + " <> 'traite'", { cutoff, E: end, D: end });
  return {
    recues: statuses,
    traitees_semaine: traitees,
    stock_fin: stockFin,
    stock_debut: stockDebut,
    evolution_stock: stockFin - stockDebut,
    total_recu_cumule: recuCumule,
    traitees_cumulees: traiteesCumulees,
    taux_cumule: recuCumule ? traiteesCumulees / recuCumule : null,
    delai_moyen_jours: avgWhere(db, base, 'a.date_traitement BETWEEN @S AND @E', { S: start, E: end }),
    urgentes_ouvertes: urgentes,
    en_retard: retard,
  };
}

function groupAtDate(db, base, dim, start, end, D) {
  const rows = db.prepare(`SELECT ${dim.id} AS id, ${dim.ar} AS label_ar, ${dim.fr} AS label_fr,
      COUNT(*) AS total,
      SUM(CASE WHEN ${STATUS_CASE()} = 'non_traite' THEN 1 ELSE 0 END) AS non_traite,
      SUM(CASE WHEN ${STATUS_CASE()} = 'en_cours' THEN 1 ELSE 0 END) AS en_cours,
      SUM(CASE WHEN ${STATUS_CASE()} = 'traite' THEN 1 ELSE 0 END) AS traite
    FROM anomalies a ${dim.join}
    ${andClause(base.clause, 'a.date_signalement BETWEEN @S AND @E')}
    GROUP BY ${dim.id} ORDER BY total DESC`)
    .all({ ...base.values, S: start, E: end, D });
  return rows.map((row) => {
    const [a, b, c] = splitPercent([row.non_traite, row.en_cours, row.traite]);
    return { ...row, pct_non_traite: a, pct_en_cours: b, pct_traite: c, taux_traitement: row.total ? row.traite / row.total : null };
  });
}

function listAtDate(db, base, condition, D, extra = {}, limit = 50) {
  return db.prepare(`SELECT a.id, a.reference, a.date_signalement, a.priorite, ${STATUS_CASE()} AS statut_au,
      t.name_ar AS type_ar, t.name_fr AS type_fr, c.name_fr AS commune_fr, c.name_ar AS commune_ar,
      da.name_fr AS daira_fr, e.name AS epic_name
    FROM anomalies a
    JOIN types_anomalie t ON t.id = a.type_id
    JOIN communes c ON c.id = a.commune_id
    JOIN dairas da ON da.id = a.daira_id
    LEFT JOIN epics e ON e.id = a.epic_id
    ${andClause(base.clause, condition)} ORDER BY a.date_signalement ASC LIMIT ${Number(limit)}`)
    .all({ ...base.values, ...extra, D });
}

function serie(db, base, S, weeks = 8) {
  const out = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = addDays(S, -7 * i);
    const end = addDays(start, 6);
    out.push({
      debut: start,
      fin: end,
      recues: countWhere(db, base, 'a.date_signalement BETWEEN @S AND @E', { S: start, E: end }),
      traitees: countWhere(db, base, 'a.date_traitement BETWEEN @S AND @E', { S: start, E: end }),
    });
  }
  return out;
}

export function buildWeeklyReport(db, options = {}) {
  const settings = getParams(db);
  const wsd = Number(settings.week_start_day) || 0;
  const retardDays = Number(settings.delai_retard_jours) || 7;
  const today = options.today || todayAlgiers();
  const S = weekStart(options.semaine || today, wsd);
  const E = addDays(S, 6);
  const filters = { ...options.filters, statut: undefined, from: undefined, to: undefined, include_infirmees: options.include_infirmees };
  const base = buildFilters(filters);
  const current = weekMetrics(db, base, S, E, retardDays);
  const prevStart = addDays(S, -7);
  const prevEnd = addDays(E, -7);
  const previous = weekMetrics(db, base, prevStart, prevEnd, retardDays);
  const pcts = splitPercent([current.recues.non_traite, current.recues.en_cours, current.recues.traite]);
  const groupes = {
    domaine: groupAtDate(db, base, DIMENSIONS.domaine, S, E, E),
    type: groupAtDate(db, base, DIMENSIONS.type, S, E, E),
    daira: groupAtDate(db, base, DIMENSIONS.daira, S, E, E),
    commune: groupAtDate(db, base, DIMENSIONS.commune, S, E, E),
    epic: groupAtDate(db, base, DIMENSIONS.epic, S, E, E),
  };
  const cutoff = addDays(E, -retardDays);
  const urgentes = listAtDate(db, base, 'a.priorite = \'urgente\' AND a.date_signalement <= @E AND ' + STATUS_CASE() + " <> 'traite'", E, { E }, 50);
  const retard = listAtDate(db, base, "a.date_signalement < @cutoff AND a.date_signalement <= @E AND " + STATUS_CASE() + " <> 'traite'", E, { E, cutoff }, 50);
  const kpis = {
    recues: current.recues.total,
    non_traite: current.recues.non_traite,
    en_cours: current.recues.en_cours,
    traite: current.recues.traite,
    pct_non_traite: pcts[0],
    pct_en_cours: pcts[1],
    pct_traite: pcts[2],
    traitees_semaine: current.traitees_semaine,
    taux_traitement: current.recues.total ? current.recues.traite / current.recues.total : null,
    taux_cumule: current.taux_cumule,
    delai_moyen_jours: current.delai_moyen_jours,
    stock_fin: current.stock_fin,
    stock_debut: current.stock_debut,
    evolution_stock: current.evolution_stock,
    urgentes_ouvertes: current.urgentes_ouvertes,
    en_retard: current.en_retard,
    total_recu_cumule: current.total_recu_cumule,
    traitees_cumulees: current.traitees_cumulees,
  };
  const deltaPct = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);
  const comparaison = {
    previous: { debut: prevStart, fin: prevEnd },
    recues: { current: kpis.recues, previous: previous.recues.total, pct: deltaPct(kpis.recues, previous.recues.total) },
    traitees: { current: kpis.traitees_semaine, previous: previous.traitees_semaine, pct: deltaPct(kpis.traitees_semaine, previous.traitees_semaine) },
    stock_fin: { current: kpis.stock_fin, previous: previous.stock_fin, pct: deltaPct(kpis.stock_fin, previous.stock_fin) },
    taux_traitement: {
      current: kpis.taux_traitement,
      previous: previous.recues.total ? previous.recues.traite / previous.recues.total : null,
      points: kpis.taux_traitement === null || !previous.recues.total ? null : Math.round((kpis.taux_traitement - previous.recues.traite / previous.recues.total) * 1000) / 10,
    },
    delai: { current: kpis.delai_moyen_jours, previous: previous.delai_moyen_jours },
    urgentes: { current: kpis.urgentes_ouvertes, previous: previous.urgentes_ouvertes },
    en_retard: { current: kpis.en_retard, previous: previous.en_retard },
  };
  const nom = settings.nom_cellule;
  const top = groupes.domaine.slice(0, 3).map((g) => `${g.label_fr || g.label_ar} (${g.total})`).join(', ');
  const arrow = kpis.evolution_stock > 0 ? '▲' : kpis.evolution_stock < 0 ? '▼' : '=';
  const detail = detailStats(db, { ...options.filters, from: S, to: E });
  const resume = [
    `Synthèse hebdomadaire — ${nom}, Wilaya d'Alger`,
    `Semaine du ${formatDate(S)} au ${formatDate(E)}`,
    `Anomalies reçues : ${kpis.recues} — Traitées : ${kpis.traite} (${percent(kpis.traite, kpis.recues) ?? '—'} %) — En cours : ${kpis.en_cours} (${percent(kpis.en_cours, kpis.recues) ?? '—'} %) — Non traitées : ${kpis.non_traite} (${percent(kpis.non_traite, kpis.recues) ?? '—'} %)`,
    `Traitées durant la semaine (toutes dates de réception) : ${kpis.traitees_semaine} · Stock ouvert : ${kpis.stock_fin} (${arrow} ${Math.abs(kpis.evolution_stock)})`,
    `Top catégories : ${top || '—'} · Urgentes ouvertes : ${kpis.urgentes_ouvertes} · En retard (> ${retardDays} j) : ${kpis.en_retard}`,
  ].join('\n');
  return {
    semaine: { debut: S, fin: E, label: `${formatDate(S)} → ${formatDate(E)}` },
    kpis,
    comparaison,
    groupes,
    listes: { urgentes, retard },
    serie_8_semaines: serie(db, base, S, 8),
    detail,
    faits: detail.faits,
    resume,
    meta: {
      genere_le: new Date().toISOString(),
      aujourd_hui: today,
      week_start_day: wsd,
      delai_retard_jours: retardDays,
      inclure_infirmees: Boolean(options.include_infirmees),
      nom_cellule: nom,
      semaine: S,
    },
  };
}

export function latestVersion(db, semaineDebut) {
  return db.prepare('SELECT MAX(version) AS v FROM rapports_hebdo WHERE semaine_debut = ?').get(semaineDebut)?.v || 0;
}

export function saveSnapshot(db, semaine, userId) {
  const report = buildWeeklyReport(db, { semaine });
  const version = latestVersion(db, report.semaine.debut) + 1;
  db.prepare(`INSERT INTO rapports_hebdo(semaine_debut, semaine_fin, version, snapshot_json, genere_par)
              VALUES (?, ?, ?, ?, ?)`)
    .run(report.semaine.debut, report.semaine.fin, version, JSON.stringify(report), userId);
  return { version, semaine_debut: report.semaine.debut, semaine_fin: report.semaine.fin, report };
}

export function listSnapshots(db, semaineDebut = null) {
  if (semaineDebut) {
    return db.prepare(`SELECT r.id, r.semaine_debut, r.semaine_fin, r.version, r.created_at, u.full_name AS genere_par_nom
                       FROM rapports_hebdo r LEFT JOIN users u ON u.id = r.genere_par
                       WHERE r.semaine_debut = ? ORDER BY r.version DESC`).all(semaineDebut);
  }
  return db.prepare(`SELECT r.id, r.semaine_debut, r.semaine_fin, r.version, r.created_at, u.full_name AS genere_par_nom,
                            (SELECT MAX(version) FROM rapports_hebdo x WHERE x.semaine_debut = r.semaine_debut) AS derniere_version
                     FROM rapports_hebdo r LEFT JOIN users u ON u.id = r.genere_par
                     ORDER BY r.semaine_debut DESC, r.version DESC`).all();
}

export function getSnapshot(db, semaineDebut, version = null) {
  const row = version
    ? db.prepare('SELECT * FROM rapports_hebdo WHERE semaine_debut = ? AND version = ?').get(semaineDebut, version)
    : db.prepare('SELECT * FROM rapports_hebdo WHERE semaine_debut = ? ORDER BY version DESC LIMIT 1').get(semaineDebut);
  if (!row) return null;
  const report = JSON.parse(row.snapshot_json);
  report.snapshot = {
    version: row.version, created_at: row.created_at, semaine_debut: row.semaine_debut, semaine_fin: row.semaine_fin,
  };
  return report;
}

export function weeklyReport(db, options = {}) {
  if (options.source === 'snapshot') {
    const row = getSnapshot(db, weekStart(options.semaine || todayAlgiers(), Number(getParams(db).week_start_day) || 0), options.version);
    if (!row) throw new Error('Version figée introuvable');
    return row;
  }
  return buildWeeklyReport(db, options);
}

export async function exportWeeklyXlsx(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Cellule technique de numérisation — Wilaya d’Alger';
  const addSheet = (name, headers, rows, widths) => {
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = headers.map((h, i) => ({ header: h, width: widths?.[i] || 18 }));
    for (const row of rows) sheet.addRow(row.map((v) => neutralizeFormula(v)));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E8A5A' } };
  };
  const k = report.kpis;
  addSheet('Synthèse', ['Indicateur', 'Valeur'], [
    ['Semaine', report.semaine.label],
    ['Anomalies reçues', k.recues],
    ['Non traitées', `${k.non_traite} (${k.pct_non_traite ?? '—'} %)`],
    ['En cours', `${k.en_cours} (${k.pct_en_cours ?? '—'} %)`],
    ['Traitées', `${k.traite} (${k.pct_traite ?? '—'} %)`],
    ['Traitées durant la semaine', k.traitees_semaine],
    ['Taux de traitement', k.taux_traitement === null ? '—' : `${Math.round(k.taux_traitement * 1000) / 10} %`],
    ['Délai moyen (jours)', k.delai_moyen_jours ?? '—'],
    ['Stock ouvert', `${k.stock_fin} (${k.evolution_stock >= 0 ? '+' : ''}${k.evolution_stock})`],
    ['Urgentes ouvertes', k.urgentes_ouvertes],
    ['En retard', k.en_retard],
  ], [36, 26]);
  for (const [key, label] of [['domaine', 'Catégories'], ['type', 'Types'], ['daira', 'Daïras'], ['commune', 'Communes'], ['epic', 'EPIC']]) {
    const rows = (report.groupes[key] || []).map((g) => [g.label_fr || g.label_ar, g.total, g.non_traite, g.en_cours, g.traite, g.pct_traite ?? 0, g.taux_traitement === null ? '—' : Math.round(g.taux_traitement * 1000) / 10]);
    addSheet(label, ['Libellé', 'Total', 'Non traitées', 'En cours', 'Traitées', '% traitées', 'Taux'], rows, [30, 10, 14, 12, 12, 12, 12]);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
