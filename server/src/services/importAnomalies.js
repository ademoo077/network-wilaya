import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import { normalize, normaliserUrl, parseGps, isFuture, todayAlgiers, MAX_IMPORT_ROWS, libelleExigences } from '@anm/shared';
import { config } from '../config/index.js';
import { getParams } from './settings.js';
import { createAnomalie } from './anomalies.js';
import { findDuplicateMatches } from './anomalyRead.js';
import { badRequest, business, AppError } from '../utils/errors.js';
import { uuid } from '../utils/crypto.js';
import {
  buildReferenceIndex, cellText, comparisonKey, mapImportStatut,
  parseImportDate, resolveCommune, resolveDaira, resolveType,
} from './importMapping.js';

export const IMPORT_COLUMNS = [
  'lien_url', 'date_signalement', 'categorie', 'type', 'daira', 'commune', 'gps', 'adresse',
  'priorite', 'verification', 'agent', 'statut', 'epic', 'date_intervention', 'date_traitement', 'observations',
];

const HEADER_ALIASES = {
  lien: 'lien_url', liens: 'lien_url', url: 'lien_url', lien_url: 'lien_url',
  lien_de_publication: 'lien_url', liens_de_publication: 'lien_url', publication: 'lien_url',
  date: 'date_signalement', dates: 'date_signalement', date_signalement: 'date_signalement',
  date_de_signalement: 'date_signalement', signalement: 'date_signalement',
  categorie: 'categorie', categories: 'categorie', domaine: 'categorie', domaines: 'categorie', category: 'categorie',
  type: 'type', types: 'type', type_anomalie: 'type', types_anomalies: 'type', type_d_anomalie: 'type',
  anomalie: 'type', anomalies: 'type',
  ca: 'ca', circonscription: 'ca', circonscription_administrative: 'ca',
  daira: 'daira', commune: 'commune', communes: 'commune',
  gps: 'gps', coordonnees: 'gps', adresse: 'adresse', adresse_texte: 'adresse',
  priorite: 'priorite', verification: 'verification', agent: 'agent', agent_nom: 'agent',
  statut: 'statut', status: 'statut', etat: 'statut', traitement: 'statut',
  epic: 'epic', date_intervention: 'date_intervention', date_traitement: 'date_traitement',
  observations: 'observations', observation: 'observations', remarques: 'observations', commentaire: 'observations',
};

const HEADER_SCAN_ROWS = 12;

const VERIF_MAP = {
  a_verifier: 'a_verifier', 'a_vérifier': 'a_verifier', averifier: 'a_verifier',
  confirmee: 'confirmee', 'confirmée': 'confirmee', infirmee: 'infirmee', 'infirmée': 'infirmee',
};
const PRIORITE_MAP = { normale: 'normale', haute: 'haute', urgente: 'urgente' };

function cleanKey(value) {
  return normalize(String(value || '')).replace(/\s+/g, '_');
}

function headerMap(values) {
  const map = {};
  const canonical = [];
  values.forEach((value, index) => {
    const key = cleanKey(cellText(value));
    if (!key) return;
    const name = HEADER_ALIASES[key];
    if (!name || map[name] !== undefined) return;
    map[name] = index;
    canonical.push(name);
  });
  return { map, canonical };
}

function scoreHeader(canonical) {
  if (!canonical.includes('lien_url')) return 0;
  let score = canonical.length;
  if (canonical.includes('type') || canonical.includes('categorie')) score += 6;
  if (canonical.includes('commune')) score += 2;
  return score;
}

function detectSheetHeader(sheet) {
  const lastRow = Math.min(Math.max(Number(sheet.rowCount) || 0, 1), HEADER_SCAN_ROWS);
  const lastCol = Math.max(Number(sheet.columnCount) || 0, 1);
  let best = null;
  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = [];
    for (let col = 1; col <= lastCol; col += 1) values.push(row.getCell(col).value);
    const { map, canonical } = headerMap(values);
    const score = scoreHeader(canonical);
    if (score > 0 && (!best || score > best.score)) best = { map, rowNumber, score };
  }
  return best;
}

async function readWorkbook(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer);
  let selection = null;
  for (const sheet of workbook.worksheets) {
    const header = detectSheetHeader(sheet);
    if (!header) continue;
    if (!selection || header.score > selection.header.score) selection = { sheet, header };
  }
  if (!selection) return { rows: [], sheetName: null };
  const { sheet, header } = selection;
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;
    const values = {};
    for (const [name, index] of Object.entries(header.map)) values[name] = cellText(row.getCell(index + 1).value);
    if (Object.values(values).some((value) => value !== '')) rows.push({ values, ligne: rowNumber });
  });
  return { rows, sheetName: sheet.name };
}

function readCsv(file) {
  const text = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
  const table = parseCsv(text, { skip_empty_lines: true, relax_column_count: true, trim: true });
  let header = null;
  for (let index = 0; index < Math.min(table.length, HEADER_SCAN_ROWS); index += 1) {
    const { map, canonical } = headerMap(table[index]);
    const score = scoreHeader(canonical);
    if (score > 0 && (!header || score > header.score)) header = { map, rowNumber: index + 1, score };
  }
  if (!header) return { rows: [], sheetName: null };
  const rows = [];
  for (let index = header.rowNumber; index < table.length; index += 1) {
    const values = {};
    for (const [name, column] of Object.entries(header.map)) values[name] = cellText(table[index][column]);
    if (Object.values(values).some((value) => value !== '')) rows.push({ values, ligne: index + 1 });
  }
  return { rows, sheetName: null };
}

/** Lit un fichier d'import et renvoie les lignes avec leur numéro d'origine. */
export async function readImportFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const parsed = ext === '.xlsx' || ext === '.xls' ? await readWorkbook(file) : readCsv(file);
  if (parsed.rows.length > MAX_IMPORT_ROWS) throw badRequest(`Maximum ${MAX_IMPORT_ROWS} lignes par import`);
  return parsed;
}

export async function parseImportFile(file) {
  const { rows } = await readImportFile(file);
  return rows.map((row) => row.values);
}

function codeOf(value, mapping, fallback = null) {
  if (!value) return fallback;
  const key = normalize(String(value)).replace(/\s+/g, '_');
  return mapping[key] || null;
}

function buildEntityMaps(db) {
  const epics = new Map();
  const agents = new Map();
  for (const epic of db.prepare('SELECT id, name, sigle FROM epics WHERE actif = 1').all()) {
    epics.set(normalize(epic.name), epic.id);
    if (epic.sigle) epics.set(normalize(epic.sigle), epic.id);
  }
  for (const agent of db.prepare('SELECT id, full_name, matricule FROM agents WHERE actif = 1').all()) {
    agents.set(normalize(agent.full_name), agent.id);
    if (agent.matricule) agents.set(normalize(agent.matricule), agent.id);
  }
  return { epics, agents };
}

function addressText(row, extra) {
  return [...(row.adresse ? [row.adresse] : []), ...extra].filter(Boolean).join(' — ').slice(0, 500) || null;
}

function buildCandidate(db, row, refs, bbox, options = {}) {
  const errors = [];
  const warnings = [];
  const today = options.today || todayAlgiers();
  const strict = Boolean(comparisonKey(row.categorie));

  const lien = String(row.lien_url || '').trim();
  const parsedUrl = normaliserUrl(lien);
  if (!parsedUrl.ok) errors.push('Lien invalide (URL http(s) attendue)');

  const typeResult = resolveType(refs.types, row.type, row.categorie, { strict });
  if (typeResult.error) errors.push(typeResult.error);
  const type = typeResult.type || null;
  if (type && typeResult.approx) {
    const label = `« ${type.domainLabel} / ${type.label} »`;
    warnings.push(row.type
      ? `Type « ${row.type} » classé en ${label} — à vérifier`
      : `Type absent — classé en ${label}`);
  }

  let daira = resolveDaira(refs.dairas, row.daira || row.ca);
  let commune = resolveCommune(refs.communes, row.commune, daira?.id);
  const extraAddress = [];
  if (!commune && row.ca) {
    const fromCa = resolveCommune(refs.communes, row.ca);
    if (fromCa) {
      commune = fromCa;
      warnings.push(`CA « ${row.ca} » interprétée comme commune`);
    }
  }
  if (row.ca && !daira) {
    warnings.push(`CA inconnue : ${row.ca} (conservée dans l'adresse)`);
    extraAddress.push(`CA : ${row.ca}`);
  }
  if (commune) {
    if (!daira) {
      daira = refs.dairas.find((item) => Number(item.id) === Number(commune.daira_id)) || null;
      if (daira) warnings.push(`Daïra déduite de la commune : ${daira.label}`);
    } else if (Number(daira.id) !== Number(commune.daira_id)) {
      const actual = refs.dairas.find((item) => Number(item.id) === Number(commune.daira_id));
      warnings.push(`CA « ${row.ca || row.daira} » ignorée : la commune « ${commune.label} » dépend de « ${actual?.label || '—'} »`);
      daira = actual || daira;
    }
  }
  if (!commune) errors.push(`Commune inconnue ou hors daïra : ${row.commune || row.ca || '—'}`);
  if (!daira) errors.push(`Daïra inconnue : ${row.daira || row.ca || '—'}`);

  const gps = parseGps(row.gps, { bbox });
  if (!gps.ok) {
    warnings.push(gps.error === 'LIEN_COURT_NON_RESOLU'
      ? 'Lien court non résolu — coordonnées ignorées'
      : 'GPS invalide — coordonnées ignorées');
  }

  const rawDate = String(row.date_signalement || '').trim();
  const parsedDate = parseImportDate(row.date_signalement);
  if (parsedDate.error) warnings.push(parsedDate.error);
  let dateSignalement = parsedDate.date;
  if (dateSignalement && isFuture(dateSignalement, today)) {
    warnings.push(`Date future (${dateSignalement}) remplacée par la date du jour`);
    dateSignalement = today;
  }
  if (!dateSignalement) {
    dateSignalement = today;
    if (!rawDate) warnings.push('Date de signalement absente — date du jour utilisée');
  }

  const statutInfo = mapImportStatut(row.statut);
  if (statutInfo.error) warnings.push(statutInfo.error);
  let statut = statutInfo.statut || 'non_traite';
  let verification = codeOf(row.verification, VERIF_MAP, 'a_verifier');
  if (row.verification && !codeOf(row.verification, VERIF_MAP)) errors.push(`Classement inconnu : ${row.verification}`);
  const priorite = codeOf(row.priorite, PRIORITE_MAP, 'normale');

  let agentId = row.agent ? refs.entities.agents.get(normalize(row.agent)) : null;
  if (row.agent && !agentId) errors.push(`Agent inconnu : ${row.agent}`);
  let epicId = row.epic ? refs.entities.epics.get(normalize(row.epic)) : null;
  if (row.epic && !epicId) errors.push(`EPIC inconnu : ${row.epic}`);
  agentId = agentId || options.agent_id || null;
  epicId = epicId || options.epic_id || null;

  const parsedIntervention = parseImportDate(row.date_intervention);
  if (parsedIntervention.error) warnings.push(parsedIntervention.error);
  const parsedTraitement = parseImportDate(row.date_traitement);
  if (parsedTraitement.error) warnings.push(parsedTraitement.error);
  let dateIntervention = parsedIntervention.date;
  let dateTraitement = parsedTraitement.date;
  let dateVerification = null;
  let statutSourceApplique = statut;

  if (statut !== 'non_traite') {
    const intervenant = epicId || row.intervenant_autre;
    if (!agentId || !intervenant) {
      warnings.push(`Statut « ${row.statut} » non appliqué : ${libelleExigences(statut, 'fr')} requis — ligne importée « Non traitée »`);
      statut = 'non_traite';
      dateIntervention = null;
      dateTraitement = null;
    } else {
      verification = 'confirmee';
      dateVerification = dateVerification || dateSignalement;
      dateIntervention = dateIntervention || dateSignalement;
      if (statut === 'traite') dateTraitement = dateTraitement || dateSignalement;
      warnings.push(`Statut « ${row.statut} » appliqué avec la date du signalement — classement à confirmer`);
    }
  }

  const notes = [];
  if (row.observations) notes.push(row.observations);
  if (type && typeResult.approx && row.type) notes.push(`Type source : ${row.type}`);
  if (statutSourceApplique !== statut) notes.push(`Statut source : ${row.statut}`);

  const data = {
    lien_url: lien,
    plateforme: parsedUrl.ok ? parsedUrl.plateforme : undefined,
    date_signalement: dateSignalement,
    domaine_id: type?.domaine_id,
    type_id: type?.id,
    daira_id: daira?.id,
    commune_id: commune?.id,
    gps: gps.ok ? (gps.lat === null ? null : { lat: gps.lat, lng: gps.lng }) : null,
    adresse_texte: addressText(row, extraAddress),
    priorite,
    verification,
    agent_id: agentId,
    statut,
    epic_id: epicId,
    date_verification: dateVerification,
    date_intervention: dateIntervention,
    date_traitement: dateTraitement,
    observations: notes.length ? notes.join('\n').slice(0, 5000) : null,
  };

  const resolved = {
    date: dateSignalement,
    statut,
    statut_source: statutInfo.statut || null,
    categorie: type?.domainLabel || null,
    type: type?.label || null,
    daira: daira?.label || null,
    commune: commune?.label || null,
    type_approx: Boolean(type && typeResult.approx),
  };

  return { data, errors, warnings, resolved, url: parsedUrl.ok ? parsedUrl.url : null };
}

function publicRow(row) {
  return {
    lien_url: row.lien_url || '',
    categorie: row.categorie || '',
    type: row.type || '',
    ca: row.ca || '',
    daira: row.daira || '',
    commune: row.commune || '',
    statut: row.statut || '',
    date: row.date_signalement || '',
    observations: row.observations || '',
  };
}

function validateImportOptions(db, options) {
  if (options.agent_id && !db.prepare('SELECT 1 FROM agents WHERE id = ? AND actif = 1').get(options.agent_id)) {
    throw badRequest('Agent affecté inconnu');
  }
  if (options.epic_id && !db.prepare('SELECT 1 FROM epics WHERE id = ? AND actif = 1').get(options.epic_id)) {
    throw badRequest('EPIC inconnu');
  }
}

export async function previewImport(db, file, user, settings, options = {}) {
  validateImportOptions(db, options);
  const parsed = await readImportFile(file);
  if (!parsed.rows.length) throw badRequest('Fichier vide ou illisible');
  const refs = { ...buildReferenceIndex(db), entities: buildEntityMaps(db) };
  const bbox = getParams(db).gps_bbox;
  const seen = new Set();
  const results = parsed.rows.map(({ values: row, ligne }) => {
    const { data, errors, warnings, resolved, url } = buildCandidate(db, row, refs, bbox, options);
    const raw = publicRow(row);
    if (errors.length) return { ligne, statut: 'error', messages: [...errors, ...warnings], raw, resolved };
    const strictKey = `${url}|${data.type_id}|${data.commune_id}`;
    if (seen.has(strictKey)) {
      return { ligne, statut: 'error', messages: [...warnings, 'Doublon strict dans le fichier'], raw, resolved };
    }
    seen.add(strictKey);
    try {
      createAnomalie(db, { ...data, force_duplicate: true }, user.id, { ...settings, dryRun: true });
      const matches = findDuplicateMatches(db, url);
      if (matches.length) warnings.push(`Lien déjà utilisé (${matches.length} fiche(s)) — import possible`);
      return { ligne, statut: warnings.length ? 'warning' : 'ok', messages: warnings, data, raw, resolved };
    } catch (error) {
      return { ligne, statut: 'error', messages: [...warnings, error.message], raw, resolved };
    }
  });
  const summary = {
    total: results.length,
    ok: results.filter((row) => row.statut === 'ok').length,
    warning: results.filter((row) => row.statut === 'warning').length,
    error: results.filter((row) => row.statut === 'error').length,
  };
  const importId = uuid();
  fs.mkdirSync(config.tmpDir, { recursive: true });
  fs.writeFileSync(path.join(config.tmpDir, `import-${importId}.json`), JSON.stringify({
    importId,
    createdAt: new Date().toISOString(),
    fileName: file.originalname,
    sheetName: parsed.sheetName,
    rows: results,
    summary,
  }));
  return { importId, fileName: file.originalname, sheetName: parsed.sheetName, rows: results, summary };
}

function readImport(importId) {
  if (!/^[a-f0-9-]{36}$/i.test(importId)) throw badRequest('Identifiant d’import invalide');
  const file = path.join(config.tmpDir, `import-${importId}.json`);
  if (!fs.existsSync(file)) throw badRequest('Import expiré — relancez l’aperçu');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export async function commitImport(db, importId, mode, user, settings) {
  const preview = readImport(importId);
  const valid = preview.rows.filter((row) => row.statut === 'ok' || row.statut === 'warning');
  const errors = preview.rows.filter((row) => row.statut === 'error').map((row) => ({ ligne: row.ligne, messages: row.messages }));
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
  const lines = ['"Ligne";"Statut";"Messages";"Lien";"Catégorie";"Type";"CA";"Daïra";"Commune";"Statut source";"Date"'];
  for (const row of preview.rows) {
    if (row.statut !== 'error') continue;
    const raw = row.raw || {};
    const cells = [row.ligne, row.statut, (row.messages || []).join(' | '), raw.lien_url, raw.categorie, raw.type, raw.ca, raw.daira, raw.commune, raw.statut, raw.date];
    lines.push(cells.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'));
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

export function importTemplate() {
  return `\uFEFF${IMPORT_COLUMNS.join(',')}\r\n`;
}
