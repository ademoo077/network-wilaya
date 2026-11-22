import ExcelJS from 'exceljs';
import { formatDate } from '@anm/shared';
import { ANOMALIE_SELECT } from './anomalyRead.js';
import { buildFilters, orderBy } from './anomalyQuery.js';

const STATUS_FR = { non_traite: 'Non traité', en_cours: 'En cours', traite: 'Traité' };
const VERIF_FR = { a_verifier: 'En attente de classement', confirmee: 'Classée', infirmee: 'Sans suite' };
const PRIORITY_FR = { normale: 'Normale', haute: 'Haute', urgente: 'Urgente' };
const PLATFORM_FR = {
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
  x: 'X', whatsapp: 'WhatsApp', telegram: 'Telegram', autre: 'Autre',
};

export function neutralizeFormula(value) {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

const COLUMNS = [
  ['Référence', (r) => r.reference, 16],
  ['Date signalement', (r) => formatDate(r.date_signalement), 14],
  ['Date publication', (r) => formatDate(r.date_publication), 14],
  ['Plateforme', (r) => PLATFORM_FR[r.plateforme] || r.plateforme, 12],
  ['Statut', (r) => STATUS_FR[r.statut] || r.statut, 14],
  ['Classement', (r) => VERIF_FR[r.verification] || r.verification, 14],
  ['Priorité', (r) => PRIORITY_FR[r.priorite] || r.priorite, 10],
  ['Catégorie', (r) => r.domaine_fr || r.domaine_ar, 26],
  ['Type', (r) => r.type_fr || r.type_ar, 26],
  ['Daïra', (r) => r.daira_fr || r.daira_ar, 18],
  ['Commune', (r) => r.commune_fr || r.commune_ar, 18],
  ['Adresse', (r) => r.adresse_texte, 28],
  ['Lieu-dit', (r) => r.lieu_dit, 20],
  ['GPS', (r) => (r.gps_lat === null ? '' : `${r.gps_lat}, ${r.gps_lng}`), 22],
  ['Agent', (r) => r.agent_nom, 20],
  ['EPIC', (r) => r.epic_name, 20],
  ['Autre intervenant', (r) => r.intervenant_autre, 20],
  ['Date intervention', (r) => formatDate(r.date_intervention), 14],
  ['Date traitement', (r) => formatDate(r.date_traitement), 14],
  ['Lien', (r) => r.lien_url, 40, 'url'],
  ['Observations', (r) => r.observations, 40],
];

function fetchRows(db, params) {
  const { clause, values } = buildFilters(params);
  return db.prepare(`${ANOMALIE_SELECT} ${clause} ${orderBy(params.sort, params.dir)}`).all(values);
}

function buildCsv(rows) {
  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = [COLUMNS.map(([header]) => escape(header)).join(';')];
  for (const row of rows) {
    lines.push(COLUMNS.map(([, getter]) => escape(neutralizeFormula(getter(row)))).join(';'));
  }
  return Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8');
}

function safeHttpUrl(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch { return null; }
}

async function buildXlsx(rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Cellule technique de numérisation — Wilaya d’Alger';
  const sheet = workbook.addWorksheet('Anomalies', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = COLUMNS.map(([header, , width]) => ({ header, width }));
  for (const row of rows) {
    sheet.addRow(COLUMNS.map(([, getter, , kind]) => {
      const raw = getter(row);
      if (kind === 'url') {
        const url = safeHttpUrl(raw);
        return url ? { text: 'Ouvrir le lien', hyperlink: url } : '';
      }
      return neutralizeFormula(raw);
    }));
  }
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E8A5A' } };
  sheet.getRow(1).alignment = { vertical: 'middle' };
  sheet.autoFilter = { from: 'A1', to: { row: 1, column: COLUMNS.length } };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function exportAnomalies(db, params, format = 'xlsx') {
  const rows = fetchRows(db, params);
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    return {
      buffer: buildCsv(rows),
      contentType: 'text/csv; charset=utf-8',
      filename: `anomalies-${stamp}.csv`,
      count: rows.length,
    };
  }
  return {
    buffer: await buildXlsx(rows),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `anomalies-${stamp}.xlsx`,
    count: rows.length,
  };
}
