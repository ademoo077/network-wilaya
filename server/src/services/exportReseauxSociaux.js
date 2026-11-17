import ExcelJS from 'exceljs';
import { COMPTE_SOCIAL_LABELS, todayAlgiers } from '@anm/shared';
import { allComptesSociaux } from './reseauxSociaux.js';
import { statsReseauxSociaux } from './statsReseauxSociaux.js';
import { neutralizeFormula } from './export.js';

const NETWORKS = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', x: 'X', whatsapp: 'WhatsApp', telegram: 'Telegram', autre: 'Autre' };
const COLUMNS = [
  ['Nom', (row) => row.nom, 38], ['Réseau', (row) => NETWORKS[row.plateforme], 14],
  ['Type', (row) => COMPTE_SOCIAL_LABELS[row.categorie].fr, 18],
  ['CA', (row) => row.ca_fr || row.ca_ar || row.ca_libelle, 22],
  ['Commune', (row) => row.commune_fr || row.commune_ar || row.commune_libelle, 22],
  ['Lien fourni', (row) => row.lien_url, 52], ['Vérification', (row) => row.verification === 'verifie' ? 'Vérifié' : 'À vérifier', 16],
  ['Actif', (row) => row.actif ? 'Oui' : 'Non', 10], ['Observations', (row) => row.observations, 48],
  ['Fichier source', (row) => row.fichier_source, 38], ['Feuille', (row) => row.feuille_source, 12],
  ['Ligne', (row) => row.ligne_source, 10], ['Colonne', (row) => row.colonne_source, 12],
  ['CA source', (row) => row.ca_source, 22], ['Commune source', (row) => row.commune_source, 22],
  ['Nom source', (row) => row.nom_source, 38],
];
const safe = (value) => neutralizeFormula(typeof value === 'string' && /^\s+[=+\-@]/.test(value) ? value.trimStart() : value);
function tableSheet(workbook, title, columns, rows) {
  const sheet = workbook.addWorksheet(title, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map(([header, , width]) => ({ header, width }));
  for (const row of rows) sheet.addRow(columns.map(([, getter]) => safe(getter(row)) ?? ''));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).height = 24;
  sheet.autoFilter = { from: 'A1', to: { row: 1, column: columns.length } };
  return sheet;
}
export async function exportReseauxSociaux(db, query, format = 'xlsx') {
  const rows = allComptesSociaux(db, query);
  const filename = `reseaux-sociaux-${todayAlgiers()}.${format}`;
  if (format === 'csv') {
    const quote = (value) => `"${String(safe(value) ?? '').replace(/"/g, '""')}"`;
    const lines = [COLUMNS.map(([label]) => quote(label)).join(';'), ...rows.map((row) => COLUMNS.map(([, getter]) => quote(getter(row))).join(';'))];
    return { buffer: Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8'), filename, count: rows.length, contentType: 'text/csv; charset=utf-8' };
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Wilaya d’Alger — Répertoire des réseaux sociaux';
  tableSheet(workbook, 'Répertoire', COLUMNS, rows);
  const stats = statsReseauxSociaux(db, query);
  const countColumns = [['Comptes', (row) => row.total, 14], ['Pages', (row) => row.pages, 14], ['Profils', (row) => row.profils, 14],
    ['Groupes', (row) => row.groupes, 14], ['Chaînes', (row) => row.chaines, 14], ['Autres', (row) => row.autres, 14],
    ['Actifs', (row) => row.actifs, 14], ['À vérifier', (row) => row.a_verifier, 14]];
  tableSheet(workbook, 'Par réseau', [['Réseau', (row) => NETWORKS[row.key], 18], ...countColumns], stats.reseaux);
  tableSheet(workbook, 'Par type', [['Type de compte', (row) => COMPTE_SOCIAL_LABELS[row.key].fr, 24], ...countColumns], stats.types);
  tableSheet(workbook, 'Par CA', [['CA', (row) => row.name_fr || row.name_ar || 'Non rattaché', 24], ...countColumns], stats.ca);
  tableSheet(workbook, 'Par commune', [['Commune', (row) => row.name_fr || row.name_ar || 'Non rattachée', 24],
    ['CA', (row) => row.ca_fr || row.ca_ar || 'Non rattaché', 24], ...countColumns], stats.communes);
  tableSheet(workbook, 'Périmètre', [['Information', (row) => row.label, 40], ['Valeur', (row) => row.value, 70]], [
    { label: 'Date d’export (Alger)', value: todayAlgiers() }, { label: 'Population', value: 'Comptes du répertoire, pas des chiffres d’audience' },
    { label: 'Filtres appliqués', value: JSON.stringify(Object.fromEntries(Object.entries(query).filter(([key]) => !['page', 'pageSize', 'format', 'sort', 'dir'].includes(key)))) },
    { label: 'Comptes exportés', value: rows.length }, { label: 'Communes couvertes (référentiel)', value: stats.resume.communes_couvertes },
    { label: 'Communes sans compte dans les filtres', value: stats.resume.communes_sans_compte },
  ]);
  return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), filename, count: rows.length,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
}
