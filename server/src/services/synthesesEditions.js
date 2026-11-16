/**
 * Éditions V8 (§ 9) : génération pour une période, lecture, figeage et export.
 *
 * Une édition figée est immuable (trigger SQL). Re-figer la même période crée
 * une version+1 : la version précédente n'est jamais modifiée.
 */
import ExcelJS from 'exceljs';
import {
  CATALOGUE, addDays, describeRequete, monthStart, todayAlgiers, weekStart,
} from '@anm/shared';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { getParams } from './settings.js';
import { evaluerRequetes, getModele } from './syntheses.js';

const MAX_BLOCS = 60;
const BATCH = 20;

function safeJson(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

/** Période demandée par le client, résolue en dates réelles. */
export function resolveEditionPeriod(db, periode = {}) {
  const today = todayAlgiers();
  const requested = periode && typeof periode === 'object' ? periode : {};
  const mode = requested.mode && requested.mode !== 'herite' ? requested.mode : 'semaine';
  if (mode === 'plage') {
    const debut = requested.debut;
    const fin = requested.fin;
    if (!debut || !fin) throw badRequest('Période personnalisée incomplète', { periode: 'dates requises' });
    if (debut > fin) throw badRequest('La date de début doit précéder la date de fin', { periode: 'ordre' });
    return { mode, debut, fin };
  }
  if (mode === 'glissant') {
    const jours = Math.min(3660, Math.max(1, Number(requested.jours) || 30));
    return { mode, debut: addDays(today, -(jours - 1)), fin: today, jours };
  }
  if (mode === 'mois') {
    const debut = monthStart(today);
    return { mode, debut, fin: addDays(monthStart(addDays(debut, 32)), -1) };
  }
  const wsd = Number(getParams(db).week_start_day) || 0;
  const debut = weekStart(today, wsd);
  return { mode: 'semaine', debut, fin: addDays(debut, 6) };
}

/** Aplatit sections → colonnes → blocs, dans l'ordre d'affichage. */
export function flattenBlocs(definition) {
  const out = [];
  for (const section of definition?.sections || []) {
    for (const colonne of section.colonnes || []) {
      for (const bloc of colonne || []) out.push({ section: section.id, bloc });
    }
  }
  return out;
}

function inject(requete, periode, filtres) {
  const merged = filtres?.length ? [...(requete.filtres || []), ...filtres] : (requete.filtres || []);
  return {
    ...requete,
    periode: { mode: 'plage', debut: periode.debut, fin: periode.fin },
    filtres: merged,
  };
}

function shapeEdition(row, { snapshot = true } = {}) {
  return {
    id: row.id,
    modele_id: row.modele_id,
    modele_nom: row.modele_nom || null,
    periode: { debut: row.periode_debut, fin: row.periode_fin },
    parametres: safeJson(row.parametres_json) || {},
    version: row.version,
    statut: row.statut,
    figee_le: row.figee_le,
    catalogue_version: row.catalogue_version,
    data_version: row.data_version,
    genere_par: row.genere_par,
    created_at: row.created_at,
    updated_at: row.updated_at,
    a_snapshot: Boolean(row.snapshot_json),
    snapshot: snapshot ? safeJson(row.snapshot_json) : null,
  };
}

function visibility(user, alias = 'm') {
  if (user.role === 'admin') return { sql: '1 = 1', params: [] };
  return { sql: `(${alias}.portee <> 'prive' OR ${alias}.proprietaire_id = ?)`, params: [user.id] };
}

function findEditionRow(db, id, user) {
  const visible = visibility(user);
  return db.prepare(`SELECT e.*, m.nom AS modele_nom, m.portee AS modele_portee,
      m.proprietaire_id AS modele_proprietaire, m.cle_systeme AS modele_cle_systeme
    FROM syntheses_editions e JOIN syntheses_modeles m ON m.id = e.modele_id
    WHERE e.id = ? AND ${visible.sql}`).get(Number(id), ...visible.params);
}

export function listEditions(db, user, { modeleId = null } = {}) {
  const visible = visibility(user);
  const params = [...visible.params];
  let sql = `SELECT e.*, m.nom AS modele_nom FROM syntheses_editions e
    JOIN syntheses_modeles m ON m.id = e.modele_id
    WHERE ${visible.sql}`;
  if (modeleId) {
    sql += ' AND e.modele_id = ?';
    params.push(Number(modeleId));
  }
  sql += ' ORDER BY e.created_at DESC, e.id DESC LIMIT 100';
  return db.prepare(sql).all(...params).map((row) => shapeEdition(row, { snapshot: false }));
}

export function getEdition(db, user, id) {
  const row = findEditionRow(db, id, user);
  if (!row) throw notFound('Édition de synthèse introuvable');
  return shapeEdition(row);
}

/** Génère (brouillon) une édition pour un modèle et une période. */
export function createEdition(db, user, body = {}) {
  if (user.role === 'lecteur') throw forbidden('Votre rôle ne permet pas de générer une édition');
  const modeleId = Number(body.modele_id);
  if (!Number.isInteger(modeleId) || modeleId < 1) {
    throw badRequest('Modèle obligatoire', { modele_id: 'Identifiant requis' });
  }
  const modele = getModele(db, modeleId, user);
  if (modele.definition.sections.length === 0) {
    throw badRequest('Ce modèle ne contient aucune section', { modele_id: 'modèle vide' });
  }
  const periode = resolveEditionPeriod(db, body.periode);
  const filtres = Array.isArray(body.filtres) ? body.filtres : [];
  const blocs = flattenBlocs(modele.definition);
  if (blocs.length > MAX_BLOCS) throw badRequest(`Un modèle est limité à ${MAX_BLOCS} blocs`);
  const datas = blocs.filter(({ bloc }) => bloc.requete);
  const specs = datas.map(({ bloc }) => inject(bloc.requete, periode, filtres));
  const resultats = [];
  for (let index = 0; index < specs.length; index += BATCH) {
    resultats.push(...evaluerRequetes(db, specs.slice(index, index + BATCH), {
      allowDeleted: user.role === 'admin',
    }));
  }
  let cursor = 0;
  const snapshot = {
    schema_version: 1,
    modele: { id: modele.id, nom: modele.nom, version: modele.version, cle_systeme: modele.cle_systeme || null },
    periode: { mode: periode.mode, debut: periode.debut, fin: periode.fin },
    filtres_globaux: filtres,
    blocs: blocs.map(({ section, bloc }) => {
      const index = bloc.requete ? cursor : -1;
      if (bloc.requete) cursor += 1;
      const resultat = index >= 0 ? resultats[index] : null;
      return {
        section,
        id: bloc.id,
        type: bloc.type,
        titre: bloc.titre || null,
        options: bloc.options || {},
        requete: index >= 0 ? specs[index] : null,
        description_fr: index >= 0 ? describeRequete(specs[index], 'fr') : null,
        description_ar: index >= 0 ? describeRequete(specs[index], 'ar') : null,
        resultat,
      };
    }),
  };
  const firstMeta = resultats[0]?.meta || {};
  const version = (db.prepare(`SELECT COALESCE(MAX(version), 0) + 1 AS next FROM syntheses_editions
    WHERE modele_id = ? AND periode_debut = ? AND periode_fin = ?`)
    .get(modele.id, periode.debut, periode.fin).next) || 1;
  const id = db.prepare(`INSERT INTO syntheses_editions
    (modele_id, periode_debut, periode_fin, parametres_json, version, statut,
     snapshot_json, catalogue_version, data_version, genere_par)
    VALUES (?, ?, ?, ?, ?, 'brouillon', ?, ?, ?, ?)`)
    .run(
      modele.id, periode.debut, periode.fin,
      JSON.stringify({ periode, filtres_globaux: filtres }),
      version, JSON.stringify(snapshot),
      firstMeta.catalogue_version || CATALOGUE.version,
      Number(firstMeta.data_version) || null,
      user.id,
    ).lastInsertRowid;
  return getEdition(db, user, id);
}

/** Fige une édition : devient immuable. Re-figer exige une nouvelle version. */
export function freezeEdition(db, user, id) {
  if (user.role === 'lecteur') throw forbidden('Votre rôle ne permet pas de figer une édition');
  const row = findEditionRow(db, id, user);
  if (!row) throw notFound('Édition de synthèse introuvable');
  const systeme = row.modele_portee === 'systeme' || Boolean(row.modele_cle_systeme);
  if (!systeme && row.modele_proprietaire !== user.id && user.role !== 'admin') {
    throw forbidden('Seul le propriétaire peut figer cette édition');
  }
  if (row.statut === 'fige') {
    throw conflict('SYNTHESE_EDITION_FIGEE', 'Cette édition est déjà figée', { version: row.version });
  }
  if (!row.snapshot_json) throw badRequest('Générez les résultats avant de figer', { snapshot: 'absent' });
  db.prepare(`UPDATE syntheses_editions
    SET statut = 'fige', figee_le = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ? AND statut <> 'fige'`).run(row.id);
  return getEdition(db, user, id);
}

function sheetName(titre, index) {
  const base = String(titre || `Widget ${index + 1}`).replace(/[\\/?*[\]:]/g, ' ').trim();
  return (base || `Widget ${index + 1}`).slice(0, 31);
}

/** Classeur Excel : une feuille par widget de données, mêmes nombres qu'à l'écran. */
export async function editionWorkbook(edition) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ANM — Wilaya d’Alger';
  const blocs = (edition.snapshot?.blocs || []).filter((bloc) => bloc.resultat);
  if (!blocs.length) {
    workbook.addWorksheet('Édition').addRow(['Aucune donnée dans cette édition']);
  }
  for (const [index, bloc] of blocs.entries()) {
    const sheet = workbook.addWorksheet(sheetName(bloc.titre || bloc.type, index));
    const resultat = bloc.resultat;
    const dimensions = resultat.colonnes?.dimensions || [];
    const mesures = resultat.colonnes?.mesures || [];
    sheet.addRow([...dimensions.map((dimension) => dimension.label_fr), ...mesures.map((mesure) => mesure.label_fr)]);
    for (const ligne of resultat.lignes || []) {
      sheet.addRow([
        ...(ligne.dimensions || []).map((dimension) => dimension.label_fr),
        ...mesures.map((mesure) => ligne.valeurs?.[mesure.id] ?? null),
      ]);
    }
    if (resultat.totaux) {
      sheet.addRow([...dimensions.map(() => 'Total'), ...mesures.map((mesure) => resultat.totaux.valeurs?.[mesure.id] ?? null)]);
    }
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((colonne) => { colonne.width = 22; });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export { shapeEdition };
