import db from '../db/database.js';
import * as stats from './stats.js';
import ExcelJS from 'exceljs';

export function computeWeekBounds(weekStartStr) {
  const start = new Date(weekStartStr + 'T00:00:00.000Z');
  const startDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() - start.getUTCDay()));
  const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { weekStart: fmt(startDate), weekEnd: fmt(new Date(endDate.getTime() - 24 * 60 * 60 * 1000)) };
}

export function getUrgentes(filters = {}) {
  const conditions = ['deleted_at IS NULL', "statut != 'traite'"];
  const params = [];
  if (filters.from) { conditions.push('date_signalement >= ?'); params.push(filters.from); }
  if (filters.to) { conditions.push('date_signalement <= ?'); params.push(filters.to); }
  if (filters.priorite) { conditions.push('priorite = ?'); params.push(filters.priorite); }
  const whereSql = ` WHERE ${conditions.join(' AND ')}`;
  const rows = db.prepare(`SELECT * FROM anomalies${whereSql} ORDER BY priorite DESC, date_signalement ASC LIMIT 50`).all(...params);
  return rows;
}

export function getWeeklyReport(weekStartStr) {
  const { weekStart, weekEnd } = computeWeekBounds(weekStartStr);
  const filters = { from: weekStart, to: weekEnd };
  const kpis = stats.getSummary(filters);
  const byCategory = stats.getByCategory(filters);
  const byType = stats.getByType(filters);
  const byDaira = stats.getByDaira(filters);
  const byCommune = stats.getByCommune(filters);
  const byEpic = stats.getByEpic(filters);
  const byPlatform = stats.getByPlatform(filters);
  const timeline = stats.getTimeline({ from: weekStart, to: weekEnd, granularity: 'week' });
  const urgentes = getUrgentes(filters);
  return {
    id: null,
    semaine_debut: weekStart,
    semaine_fin: weekEnd,
    genere_le: new Date().toISOString(),
    kpis,
    byCategory,
    byType,
    byDaira,
    byCommune,
    byEpic,
    byPlatform,
    timeline,
    urgentes,
  };
}

export function saveWeeklySnapshot({ semaine_debut, semaine_fin, snapshotJson, userId }) {
  const at = new Date().toISOString();
  const info = db.prepare('INSERT INTO rapports_hebdo (semaine_debut, semaine_fin, snapshot_json, genere_par, at) VALUES (?, ?, ?, ?, ?)').run(semaine_debut, semaine_fin, snapshotJson, userId, at);
  const row = db.prepare('SELECT * FROM rapports_hebdo WHERE id = ?').get(Number(info.lastInsertRowid));
  return row;
}

export function listWeeklySnapshots() {
  const rows = db.prepare('SELECT id, semaine_debut, semaine_fin, snapshot_json, genere_par, at FROM rapports_hebdo ORDER BY id DESC').all();
  return rows;
}

export async function buildWeeklyReportXlsx(report) {
  const workbook = new ExcelJS.Workbook();
  const summarySheet = workbook.addWorksheet('Resume');
  summarySheet.addRow(['Indicateur', 'Valeur']);
  summarySheet.addRow(['Semaine debut', report.semaine_debut]);
  summarySheet.addRow(['Semaine fin', report.semaine_fin]);
  summarySheet.addRow(['Total receptions', report.kpis.total]);
  summarySheet.addRow(['Non traite', report.kpis.parStatut.non_traite]);
  summarySheet.addRow(['En cours', report.kpis.parStatut.en_cours]);
  summarySheet.addRow(['Traitee', report.kpis.parStatut.traite]);
  summarySheet.addRow(['Taux de traitement', report.kpis.tauxTraitement]);

  const categorySheet = workbook.addWorksheet('Par categorie');
  categorySheet.addRow(['Domaine', 'Non traite', 'En cours', 'Traitee']);
  for (const row of report.byCategory) {
    categorySheet.addRow([row.domaine_name, row.counts.non_traite, row.counts.en_cours, row.counts.traite]);
  }

  const typeSheet = workbook.addWorksheet('Par type');
  typeSheet.addRow(['Type', 'Domaine', 'Non traite', 'En cours', 'Traitee']);
  for (const row of report.byType) {
    typeSheet.addRow([row.type_name, row.domaine_id, row.counts.non_traite, row.counts.en_cours, row.counts.traite]);
  }

  const epicSheet = workbook.addWorksheet('Par EPIC');
  epicSheet.addRow(['EPIC', 'Non traite', 'En cours', 'Traitee']);
  for (const row of report.byEpic) {
    epicSheet.addRow([row.epic_name, row.counts.non_traite, row.counts.en_cours, row.counts.traite]);
  }

  const urgentSheet = workbook.addWorksheet('Urgentes');
  urgentSheet.addRow(['Reference', 'Lien', 'Priorite', 'Statut', 'Date signalement']);
  for (const row of report.urgentes) {
    urgentSheet.addRow([row.reference, row.lien_url, row.priorite, row.statut, row.date_signalement]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
