import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { MAX_IMPORT_ROWS, normalize, normaliserCompteSocial, normaliserUrl, reseauxSociauxSourceSchema, socialTerritoryKey } from '@anm/shared';
import { config } from '../config/index.js';
import { badRequest, forbidden, notFound, tooLarge } from '../utils/errors.js';
import { createCompteSocial } from './reseauxSociaux.js';

export const RESEAUX_SOURCE_FILE = new URL('../../../seed/reseaux-sociaux-lien.json', import.meta.url);
const PREVIEW_TTL_MS = 15 * 60 * 1000;

function textCell(cell, hyperlink = false) {
  if (!cell) return '';
  const value = cell.value;
  if (hyperlink) {
    const link = (value && typeof value === 'object' && (value.hyperlink || value.target))
      || (typeof cell.hyperlink === 'string' ? cell.hyperlink : cell.hyperlink?.target);
    if (link) return String(link).trim();
  }
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value.text) return String(value.text).trim();
    if (value.richText) return value.richText.map((part) => part.text).join('').trim();
    return '';
  }
  return String(value).trim();
}
const emptyCell = () => ({ value: null });
const cellAt = (row, column) => (column > 0 ? row.getCell(column) : emptyCell());
export function suppliedSocialSource() {
  if (!fs.existsSync(RESEAUX_SOURCE_FILE)) throw notFound('Le tableau fourni n’est pas disponible');
  return reseauxSociauxSourceSchema.parse(JSON.parse(fs.readFileSync(RESEAUX_SOURCE_FILE, 'utf8')));
}

const CONTACT_HEADER = /(telephone|phone|mobile|portable|gsm|contact|email|e-mail|mail|whatsapp|numero|n°|fax)/;
const LIEN_HEADER = /^liens?\b/;
const AUTRES_HEADER = /^(autres?\b|second lien|lien 2|lien de droite)/;

/** Repère l'en-tête LIEN même si des colonnes ont été ajoutées ou déplacées. */
export function detectSocialColumns(sheet) {
  for (let number = 1; number <= Math.min(20, sheet.rowCount); number += 1) {
    const row = sheet.getRow(number);
    const labels = Array.from({ length: 12 }, (_, index) => normalize(textCell(cellAt(row, index + 1))));
    const filled = labels.filter(Boolean);
    if (filled.length < 2) continue;
    if (labels.some((label) => CONTACT_HEADER.test(label))) {
      throw badRequest('Les colonnes de contact (téléphone, e-mail, WhatsApp) ne peuvent pas être importées');
    }
    const ca = labels.findIndex((label) => ['ca', 'c a', 'daira'].includes(label));
    const commune = labels.findIndex((label) => ['commune', 'communes'].includes(label));
    const liens = labels.map((label, index) => (LIEN_HEADER.test(label) ? index : -1)).filter((index) => index >= 0);
    const autres = labels.map((label, index) => (AUTRES_HEADER.test(label) ? index : -1)).filter((index) => index >= 0);
    if (ca < 0 || commune < 0 || !liens.length) continue;
    const premier = liens[0];
    const second = [...liens, ...autres].filter((index) => index > premier).sort((a, b) => a - b)[0];
    return { header: number, ca: ca + 1, commune: commune + 1, lienA: premier + 1, nomA: premier + 2,
      lienB: second === undefined ? 0 : second + 1, nomB: second === undefined ? 0 : second + 2 };
  }
  throw badRequest('En-tête CA / COMMUNES / lien introuvable dans la feuille LIEN');
}

/** Seule la feuille LIEN est lue ; les onglets d'anomalies et de contacts ne sont jamais importés. */
export async function parseSocialWorkbook(file) {
  if (!file?.buffer || path.extname(file.originalname || '').toLowerCase() !== '.xlsx') throw badRequest('Un fichier Excel .xlsx est requis');
  if (file.buffer.length > 5 * 1024 * 1024) throw tooLarge();
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(file.buffer); } catch { throw badRequest('Fichier Excel illisible'); }
  const sheet = workbook.worksheets.find((entry) => normalize(entry.name) === 'lien');
  if (!sheet) {
    const defaultSheet = workbook.worksheets.some((entry) => /^feuil1$/i.test(entry.name));
    throw badRequest(defaultSheet
      ? 'La feuille « LIEN » est requise : « Feuil1 » ne peut pas être importée (aucune donnée de réseaux sociaux n’y est reconnue)'
      : 'La feuille « LIEN » est requise (CA, COMMUNES, lien, nom, autres, nom)');
  }
  const columns = detectSocialColumns(sheet);
  const lignes = []; let ca = ''; let commune = '';
  sheet.eachRow({ includeEmpty: false }, (row, number) => {
    if (number <= columns.header) return;
    const communeCell = textCell(cellAt(row, columns.commune));
    const nextCa = textCell(cellAt(row, columns.ca));
    if (nextCa && nextCa !== ca) { ca = nextCa; commune = ''; }
    commune = communeCell || commune;
    const lien = textCell(cellAt(row, columns.lienA), true);
    const autres = textCell(cellAt(row, columns.lienB), true);
    const nom = textCell(cellAt(row, columns.nomA));
    const nom_autres = textCell(cellAt(row, columns.nomB));
    if (![nextCa, communeCell, lien, autres, nom, nom_autres].some(Boolean)) return;
    lignes.push({ ligne: number, ca, commune, lien, nom, autres, nom_autres });
  });
  if (lignes.length > MAX_IMPORT_ROWS) throw tooLarge(`Maximum ${MAX_IMPORT_ROWS} lignes`);
  const parsed = reseauxSociauxSourceSchema.safeParse({ fichier: path.basename(file.originalname).slice(0, 200), feuille: 'LIEN', lignes });
  if (!parsed.success) throw badRequest('Le tableau contient des cellules trop longues ou aucune ligne exploitable');
  return parsed.data;
}

function singleMatch(rows, label) {
  if (!label) return null;
  const key = socialTerritoryKey(label);
  const matches = rows.filter((row) => [row.name_fr, row.name_ar].filter(Boolean).some((name) => socialTerritoryKey(name) === key));
  return matches.length === 1 && matches[0].actif === 1 ? matches[0] : null;
}
function sourceCandidates(source, maps) {
  const candidates = [];
  for (const row of source.lignes) {
    const daira = singleMatch(maps.dairas, row.ca);
    const foundCommune = singleMatch(maps.communes, row.commune);
    const commune = foundCommune && foundCommune.daira_id === daira?.id ? foundCommune : null;
    for (const [colonne, lien, nomSource, defaultType] of [['C', row.lien, row.nom, 'page'], ['E', row.autres, row.nom_autres, 'profil']]) {
      if (!lien) continue;
      const url = normaliserCompteSocial(lien);
      const nom = normaliserUrl(nomSource).ok ? '' : nomSource.trim();
      const messages = [];
      if (!nom) messages.push('nom_manquant');
      if (!daira || !commune) messages.push(foundCommune && daira ? 'rattachement_incoherent' : 'territoire_non_rattache');
      if (url.ok && url.publication) messages.push('lien_publication');
      messages.push('type_a_confirmer');
      candidates.push({ ligne: row.ligne, colonne, nom, lien_url: lien, plateforme: url.ok ? url.plateforme : 'autre',
        categorie: url.ok && url.nature ? url.nature : defaultType, ca_libelle: row.ca, commune_libelle: row.commune,
        daira_id: daira?.id || null, commune_id: commune?.id || null, observations: '', verification: 'a_verifier', actif: 1,
        messages, erreur: !url.ok ? 'Lien HTTP(S) invalide ou lien de compte manquant' : nom.length > 200 ? 'Nom trop long (200 caractères maximum)' : null,
        lien_normalise: url.ok ? url.url : null,
        provenance: { fichier: source.fichier, feuille: source.feuille, ligne: row.ligne, colonne, nom: nomSource, ca: row.ca, commune: row.commune } });
    }
  }
  return candidates;
}

export function previewSocialImport(db, rawSource) {
  const source = reseauxSociauxSourceSchema.parse(rawSource);
  const maps = { dairas: db.prepare('SELECT * FROM dairas').all(), communes: db.prepare('SELECT * FROM communes').all() };
  const existing = new Map(db.prepare('SELECT id,lien_normalise FROM comptes_sociaux').all().map((row) => [row.lien_normalise, row.id]));
  const seen = new Set();
  const summary = { total: 0, nouveaux: 0, existants: 0, doublons: 0, erreurs: 0,
    sans_lien: source.lignes.filter((row) => !row.lien && !row.autres).length, a_verifier: 0 };
  const rows = sourceCandidates(source, maps).map((candidate) => {
    const existingId = existing.get(candidate.lien_normalise) || null;
    const statut = candidate.erreur ? 'erreur' : existingId ? 'existant' : seen.has(candidate.lien_normalise) ? 'doublon' : 'nouveau';
    if (candidate.lien_normalise) seen.add(candidate.lien_normalise);
    summary.total += 1;
    summary[{ nouveau: 'nouveaux', existant: 'existants', doublon: 'doublons', erreur: 'erreurs' }[statut]] += 1;
    if (statut === 'nouveau') summary.a_verifier += 1;
    return { ...candidate, statut, existingId };
  });
  return { fichier: source.fichier, feuille: source.feuille, rows, summary };
}

/** Ajout seulement : les libellés, corrections et désactivations existants sont intouchés. */
export function importComptesSociaux(db, source, userId = null) {
  return db.transaction(() => {
    const preview = previewSocialImport(db, source);
    const ids = [];
    for (const row of preview.rows) {
      if (row.statut !== 'nouveau') continue;
      ids.push(createCompteSocial(db, row, userId, row.provenance).id);
    }
    return { created: ids.length, ids, skipped: preview.summary.total - ids.length,
      summary: preview.summary, errors: preview.rows.filter((row) => row.statut === 'erreur').map((row) => ({ ligne: row.ligne, colonne: row.colonne, message: row.erreur })) };
  })();
}

function previewPath(importId) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(importId)) throw badRequest('Identifiant d’import invalide');
  return path.join(config.tmpDir, `reseaux-import-${importId}.json`);
}
export function createSocialImportPreview(db, source, userId) {
  const preview = previewSocialImport(db, source);
  const importId = randomUUID(); const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS).toISOString();
  fs.mkdirSync(config.tmpDir, { recursive: true });
  fs.writeFileSync(previewPath(importId), JSON.stringify({ source, userId, expiresAt, result: null }), { flag: 'wx' });
  return { ...preview, importId, expiresAt };
}
export function readSocialImportPreview(importId, userId) {
  const file = previewPath(importId);
  if (!fs.existsSync(file)) throw badRequest('Import expiré — relancez l’aperçu');
  const preview = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (preview.userId !== userId) throw forbidden('Cet aperçu appartient à un autre administrateur');
  if (new Date(preview.expiresAt).getTime() < Date.now()) throw badRequest('Import expiré — relancez l’aperçu');
  return preview;
}
export function commitSocialImportPreview(db, importId, userId) {
  const preview = readSocialImportPreview(importId, userId);
  if (preview.result) return { ...preview.result, deja_applique: true };
  const result = importComptesSociaux(db, preview.source, userId);
  fs.writeFileSync(previewPath(importId), JSON.stringify({ ...preview, result }));
  return { ...result, deja_applique: false };
}

/** L'administrateur peut jeter un aperçu non appliqué ; rien n'est écrit en base. */
export function cancelSocialImportPreview(importId, userId) {
  const preview = readSocialImportPreview(importId, userId);
  if (preview.result) throw badRequest('Cet import a déjà été appliqué — il ne peut plus être annulé');
  fs.unlinkSync(previewPath(importId));
  return { annule: true, importId };
}
