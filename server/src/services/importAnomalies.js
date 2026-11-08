import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import { normalize, normaliserUrl, parseGps, MAX_IMPORT_ROWS } from '@anm/shared';
import { config } from '../config/index.js';
import { getParams } from './settings.js';
import { createAnomalie } from './anomalies.js';
import { findDuplicateMatches } from './anomalyRead.js';
import { badRequest, business, AppError } from '../utils/errors.js';
import { uuid } from '../utils/crypto.js';

export const IMPORT_COLUMNS = [
  'lien_url', 'date_signalement', 'categorie', 'type', 'daira', 'commune', 'gps', 'adresse',
  'priorite', 'verification', 'agent', 'statut', 'epic', 'date_intervention', 'date_traitement', 'observations',
];

const HEADER_ALIASES = {
  lien: 'lien_url', url: 'lien_url', lien_url: 'lien_url',
  date_signalement: 'date_signalement', signalement: 'date_signalement',
  categorie: 'categorie', domaine: 'categorie', category: 'categorie',
  type: 'type', daira: 'daira', commune: 'commune', gps: 'gps', adresse: 'adresse',
  priorite: 'priorite', verification: 'verification', agent: 'agent', statut: 'statut',
  epic: 'epic', date_intervention: 'date_intervention', date_traitement: 'date_traitement',
  observations: 'observations',
};

function cleanKey(value) {
  return normalize(String(value || '')).replace(/\s+/g, '_');
}

function cellValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((r) => r.text).join('');
    if (value.text) return value.text;
    if (value.result !== undefined) return value.result;
    return '';
  }
  return String(value).trim();
}

export async function parseImportFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  let rows;
  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const headers = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => { headers[col - 1] = cleanKey(cellValue(cell.value)); });
    rows = [];
    sheet.eachRow((row, index) => {
      if (index === 1) return;
      const obj = {};
      headers.forEach((header, i) => { if (header) obj[HEADER_ALIASES[header] || header] = cellValue(row.getCell(i + 1).value); });
      if (Object.values(obj).some((v) => v !== '')) rows.push(obj);
    });
  } else {
    const text = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    const parsed = parseCsv(text, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
    rows = parsed.map((raw) => {
      const obj = {};
      for (const [key, value] of Object.entries(raw)) obj[HEADER_ALIASES[cleanKey(key)] || cleanKey(key)] = cellValue(value);
      return obj;
    });
  }
  if (rows.length > MAX_IMPORT_ROWS) throw badRequest(`Maximum ${MAX_IMPORT_ROWS} lignes par import`);
  return rows;
}

function isoDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : text;
}

function codeOf(value, mapping, fallback = null) {
  if (!value) return fallback;
  const key = normalize(String(value)).replace(/\s+/g, '_');
  return mapping[key] || null;
}

const STATUT_MAP = {
  non_traite: 'non_traite', non_traite_: 'non_traite', 'non_traité': 'non_traite', non_traitee: 'non_traite',
  en_cours: 'en_cours', encours: 'en_cours', traite: 'traite', 'traité': 'traite', traitee: 'traite',
};
const VERIF_MAP = {
  a_verifier: 'a_verifier', 'a_vérifier': 'a_verifier', averifier: 'a_verifier',
  confirmee: 'confirmee', 'confirmée': 'confirmee', infirmee: 'infirmee', 'infirmée': 'infirmee',
};
const PRIORITE_MAP = { normale: 'normale', haute: 'haute', urgente: 'urgente' };

function buildMaps(db) {
  const maps = { domaines: new Map(), types: new Map(), dairas: new Map(), communes: new Map(), epics: new Map(), agents: new Map() };
  for (const d of db.prepare('SELECT id, name_ar, name_fr FROM domaines').all()) {
    maps.domaines.set(normalize(d.name_ar), d.id);
    if (d.name_fr) maps.domaines.set(normalize(d.name_fr), d.id);
  }
  for (const t of db.prepare('SELECT id, domaine_id, name_ar, name_fr FROM types_anomalie').all()) {
    maps.types.set(`${t.domaine_id}|${normalize(t.name_ar)}`, t.id);
    if (t.name_fr) maps.types.set(`${t.domaine_id}|${normalize(t.name_fr)}`, t.id);
  }
  for (const d of db.prepare('SELECT id, name_fr, name_ar FROM dairas').all()) {
    maps.dairas.set(normalize(d.name_fr), d.id);
    if (d.name_ar) maps.dairas.set(normalize(d.name_ar), d.id);
  }
  for (const c of db.prepare('SELECT id, daira_id, name_fr, name_ar FROM communes').all()) {
    maps.communes.set(`${c.daira_id}|${normalize(c.name_fr)}`, c.id);
    if (c.name_ar) maps.communes.set(`${c.daira_id}|${normalize(c.name_ar)}`, c.id);
  }
  for (const e of db.prepare('SELECT id, name, sigle FROM epics').all()) {
    maps.epics.set(normalize(e.name), e.id);
    if (e.sigle) maps.epics.set(normalize(e.sigle), e.id);
  }
  for (const a of db.prepare('SELECT id, full_name, matricule FROM agents').all()) {
    maps.agents.set(normalize(a.full_name), a.id);
    if (a.matricule) maps.agents.set(normalize(a.matricule), a.id);
  }
  return maps;
}

function buildCandidate(db, row, maps, bbox) {
  const errors = [];
  const lien = String(row.lien_url || '').trim();
  const parsedUrl = normaliserUrl(lien);
  if (!parsedUrl.ok) errors.push('Lien invalide (URL http(s) attendue)');
  const domaineId = maps.domaines.get(normalize(row.categorie));
  if (!domaineId) errors.push(`Catégorie inconnue : ${row.categorie || '—'}`);
  const typeId = domaineId ? maps.types.get(`${domaineId}|${normalize(row.type)}`) : null;
  if (!typeId) errors.push(`Type inconnu ou hors catégorie : ${row.type || '—'}`);
  const dairaId = maps.dairas.get(normalize(row.daira));
  if (!dairaId) errors.push(`Daïra inconnue : ${row.daira || '—'}`);
  const communeId = dairaId ? maps.communes.get(`${dairaId}|${normalize(row.commune)}`) : null;
  if (!communeId) errors.push(`Commune inconnue ou hors daïra : ${row.commune || '—'}`);
  const gps = parseGps(row.gps, { bbox });
  if (!gps.ok) errors.push(gps.error === 'LIEN_COURT_NON_RESOLU' ? 'Lien court non résolu — collez les coordonnées' : 'GPS invalide');
  const statut = codeOf(row.statut, STATUT_MAP, 'non_traite');
  if (row.statut && !codeOf(row.statut, STATUT_MAP)) errors.push(`Statut inconnu : ${row.statut}`);
  const verification = codeOf(row.verification, VERIF_MAP, 'a_verifier');
  if (row.verification && !codeOf(row.verification, VERIF_MAP)) errors.push(`Vérification inconnue : ${row.verification}`);
  const priorite = codeOf(row.priorite, PRIORITE_MAP, 'normale');
  const agentId = row.agent ? maps.agents.get(normalize(row.agent)) : null;
  if (row.agent && !agentId) errors.push(`Agent inconnu : ${row.agent}`);
  const epicId = row.epic ? maps.epics.get(normalize(row.epic)) : null;
  if (row.epic && !epicId) errors.push(`EPIC inconnu : ${row.epic}`);
  const data = {
    lien_url: lien,
    plateforme: parsedUrl.ok ? parsedUrl.plateforme : undefined,
    date_signalement: isoDate(row.date_signalement) || undefined,
    domaine_id: domaineId,
    type_id: typeId,
    daira_id: dairaId,
    commune_id: communeId,
    gps: gps.ok ? (gps.lat === null ? null : { lat: gps.lat, lng: gps.lng }) : null,
    adresse_texte: row.adresse || null,
    priorite,
    verification,
    agent_id: agentId,
    statut,
    epic_id: epicId,
    date_intervention: isoDate(row.date_intervention) || undefined,
    date_traitement: isoDate(row.date_traitement) || undefined,
    observations: row.observations || null,
  };
  return { data, errors, url: parsedUrl.ok ? parsedUrl.url : null };
}

export async function previewImport(db, file, user, settings) {
  const rows = await parseImportFile(file);
  if (!rows.length) throw badRequest('Fichier vide ou illisible');
  const maps = buildMaps(db);
  const bbox = getParams(db).gps_bbox;
  const seen = new Set();
  const results = rows.map((row, index) => {
    const { data, errors, url } = buildCandidate(db, row, maps, bbox);
    const ligne = index + 2;
    if (errors.length) return { ligne, statut: 'error', messages: errors, raw: publicRow(row) };
    const strictKey = `${url}|${data.type_id}|${data.commune_id}`;
    if (seen.has(strictKey)) return { ligne, statut: 'error', messages: ['Doublon strict dans le fichier'], raw: publicRow(row) };
    seen.add(strictKey);
    try {
      createAnomalie(db, { ...data, force_duplicate: true }, user.id, { ...settings, dryRun: true });
      const matches = findDuplicateMatches(db, url);
      const warnings = matches.length ? [`Lien déjà utilisé (${matches.length} fiche(s)) — import possible`] : [];
      if (warnings.length) return { ligne, statut: 'warning', messages: warnings, data, raw: publicRow(row) };
      return { ligne, statut: 'ok', messages: [], data, raw: publicRow(row) };
    } catch (error) {
      if (error.code === 'DUPLICATE_STRICT') return { ligne, statut: 'error', messages: [error.message], raw: publicRow(row) };
      return { ligne, statut: 'error', messages: [error.message], raw: publicRow(row) };
    }
  });
  const summary = {
    total: results.length,
    ok: results.filter((r) => r.statut === 'ok').length,
    warning: results.filter((r) => r.statut === 'warning').length,
    error: results.filter((r) => r.statut === 'error').length,
  };
  const importId = uuid();
  fs.mkdirSync(config.tmpDir, { recursive: true });
  fs.writeFileSync(path.join(config.tmpDir, `import-${importId}.json`), JSON.stringify({
    importId, createdAt: new Date().toISOString(), fileName: file.originalname, rows: results, summary,
  }));
  return { importId, fileName: file.originalname, rows: results, summary };
}

function publicRow(row) {
  return { lien_url: row.lien_url, categorie: row.categorie, type: row.type, daira: row.daira, commune: row.commune };
}

function readImport(importId) {
  if (!/^[a-f0-9-]{36}$/i.test(importId)) throw badRequest('Identifiant d’import invalide');
  const file = path.join(config.tmpDir, `import-${importId}.json`);
  if (!fs.existsSync(file)) throw badRequest('Import expiré — relancez l’aperçu');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export async function commitImport(db, importId, mode, user, settings) {
  const preview = readImport(importId);
  const valid = preview.rows.filter((r) => r.statut === 'ok' || r.statut === 'warning');
  const errors = preview.rows.filter((r) => r.statut === 'error').map((r) => ({ ligne: r.ligne, messages: r.messages }));
  if (mode === 'all_or_nothing' && errors.length) {
    throw new AppError(422, 'IMPORT_BLOQUE', `Import annulé : ${errors.length} ligne(s) en erreur`, null, errors);
  }
  let created = 0;
  const commitErrors = [];
  db.transaction(() => {
    for (const row of valid) {
      try {
        createAnomalie(db, { ...row.data, force_duplicate: true }, user.id, settings);
        created += 1;
      } catch (error) {
        commitErrors.push({ ligne: row.ligne, messages: [error.message] });
        if (mode === 'all_or_nothing') throw error;
      }
    }
    if (mode === 'all_or_nothing' && commitErrors.length) throw business('Import annulé — une ligne a échoué', 'IMPORT_BLOQUE');
  })();
  return {
    importId,
    created,
    skipped: errors.length,
    errors: [...errors, ...commitErrors],
    summary: { ...preview.summary, created, errors: errors.length + commitErrors.length },
  };
}

export function importErrorsCsv(importId) {
  const preview = readImport(importId);
  const lines = ['"Ligne";"Statut";"Messages";"Lien";"Catégorie";"Type";"Daïra";"Commune"'];
  for (const row of preview.rows) {
    if (row.statut !== 'error') continue;
    const raw = row.raw || {};
    const cells = [row.ligne, row.statut, (row.messages || []).join(' | '), raw.lien_url, raw.categorie, raw.type, raw.daira, raw.commune];
    lines.push(cells.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'));
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

export function importTemplate() {
  return `\uFEFF${IMPORT_COLUMNS.join(',')}\r\n`;
}
