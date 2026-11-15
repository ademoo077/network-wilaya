/**
 * Service V8 des synthèses : catalogue, évaluation par lot et CRUD des modèles.
 *
 * Toute requête passe par `evaluateSynthese` (liste blanche + valeurs liées).
 * Les modèles système sont en lecture seule : seule la duplication est permise.
 */
import { CATALOGUE, todayAlgiers, validerRequete } from '@anm/shared';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { evaluateSynthese } from '../synthese/engine.js';

const MAX_REQUETES = 20;
const MAX_NOM = 200;

/** Catalogue exposé au client : listes ordonnées, jamais de SQL. */
export function cataloguePayload() {
  return {
    version: CATALOGUE.version,
    datasets: Object.values(CATALOGUE.datasets),
    dimensions: Object.values(CATALOGUE.dimensions),
    mesures: Object.values(CATALOGUE.mesures),
    filtres: Object.values(CATALOGUE.filtres),
    formats: Object.values(CATALOGUE.formats),
    granularites: Object.values(CATALOGUE.granularites),
    ops: Object.values(CATALOGUE.ops),
    formats_ids: CATALOGUE.formats_ids,
  };
}

function syntheseError(error) {
  if (error?.code === 'SYNTHESE_PERMISSION') return forbidden(error.message);
  if (error?.code === 'SYNTHESE_REQUETE_INVALIDE') return badRequest(error.message, error.fields);
  if (error?.code === 'SYNTHESE_DEFINITION_INVALIDE') return badRequest(error.message, error.fields);
  return error;
}

/** Valide et normalise une requête sans l’exécuter. */
export function normaliserRequete(rawSpec, { allowDeleted = false } = {}) {
  try {
    return validerRequete(rawSpec, { allowDeleted });
  } catch (error) {
    throw syntheseError(error);
  }
}

/** Évalue un lot de 1 à 20 requêtes ; le lot est refusé en bloc si une requête est invalide. */
export function evaluerRequetes(db, specs, { allowDeleted = false } = {}) {
  if (!Array.isArray(specs) || specs.length < 1 || specs.length > MAX_REQUETES) {
    throw badRequest(`Entre 1 et ${MAX_REQUETES} requêtes attendues`, { requetes: `1 à ${MAX_REQUETES}` });
  }
  const today = todayAlgiers();
  return specs.map((spec, index) => {
    try {
      return evaluateSynthese(db, spec, { today, allowDeleted });
    } catch (error) {
      if (error?.code?.startsWith('SYNTHESE_') && error.code !== 'SYNTHESE_PERMISSION') {
        error.message = `Requête ${index + 1} : ${error.message}`;
        error.fields = { [`requetes.${index}`]: error.fields?.requete || '' };
      }
      throw syntheseError(error);
    }
  });
}

function visibleClause(user) {
  if (user.role === 'admin') return { sql: '1 = 1', params: [] };
  return { sql: "(m.portee <> 'prive' OR m.proprietaire_id = ?)", params: [user.id] };
}

function shapeModele(row, user) {
  let definition = { schema_version: 1, sections: [] };
  try {
    definition = JSON.parse(row.definition_json);
  } catch {
    // une définition corrompue reste lisible mais n’est pas exploitable
  }
  const systeme = row.portee === 'systeme' || Boolean(row.cle_systeme);
  const proprietaire = row.proprietaire_id === user.id;
  return {
    id: row.id,
    nom: row.nom,
    description: row.description,
    proprietaire_id: row.proprietaire_id,
    portee: row.portee,
    schema_version: row.schema_version,
    version: row.version,
    cle_systeme: row.cle_systeme,
    definition,
    archive: Boolean(row.archive),
    created_at: row.created_at,
    updated_at: row.updated_at,
    est_proprietaire: proprietaire,
    modifiable: !systeme && (proprietaire || user.role === 'admin'),
  };
}

function findVisibleRow(db, id, user) {
  const visible = visibleClause(user);
  return db.prepare(`SELECT m.* FROM syntheses_modeles m
    WHERE m.id = ? AND m.archive = 0 AND ${visible.sql}`)
    .get(Number(id), ...visible.params);
}

export function listModeles(db, user) {
  const visible = visibleClause(user);
  const rows = db.prepare(`SELECT m.* FROM syntheses_modeles m
    WHERE m.archive = 0 AND ${visible.sql}
    ORDER BY CASE m.portee WHEN 'systeme' THEN 0 WHEN 'equipe' THEN 1 ELSE 2 END,
             m.updated_at DESC, m.id DESC`).all(...visible.params);
  return rows.map((row) => shapeModele(row, user));
}

export function getModele(db, id, user) {
  const row = findVisibleRow(db, id, user);
  if (!row) throw notFound('Modèle de synthèse introuvable');
  return shapeModele(row, user);
}

export function createModele(db, user, payload) {
  const nom = String(payload.nom || '').trim().slice(0, MAX_NOM);
  if (!nom) throw badRequest('Nom obligatoire', { nom: 'Nom requis' });
  const portee = payload.portee || 'prive';
  if (portee === 'systeme') throw badRequest('Un modèle système ne se crée pas par l’API', { portee: 'Portée invalide' });
  if (portee === 'equipe' && user.role === 'lecteur') throw forbidden('Votre rôle ne permet pas de partager un modèle');
  const definition = JSON.stringify(payload.definition);
  const id = db.prepare(`INSERT INTO syntheses_modeles
    (nom, description, proprietaire_id, portee, definition_json, schema_version, version)
    VALUES (?, ?, ?, ?, ?, 1, 1)`)
    .run(nom, payload.description || null, user.id, portee, definition).lastInsertRowid;
  return getModele(db, id, user);
}

export function updateModele(db, user, id, payload) {
  const row = findVisibleRow(db, id, user);
  if (!row) throw notFound('Modèle de synthèse introuvable');
  if (row.portee === 'systeme' || row.cle_systeme) {
    throw forbidden('Un modèle système se duplique, il ne se modifie pas');
  }
  if (row.proprietaire_id !== user.id && user.role !== 'admin') throw notFound('Modèle de synthèse introuvable');
  const nom = String(payload.nom || '').trim().slice(0, MAX_NOM);
  if (!nom) throw badRequest('Nom obligatoire', { nom: 'Nom requis' });
  const portee = payload.portee || row.portee;
  if (portee === 'systeme') throw badRequest('Portée système réservée aux migrations', { portee: 'Portée invalide' });
  if (portee === 'equipe' && user.role === 'lecteur') throw forbidden('Votre rôle ne permet pas de partager un modèle');
  db.prepare(`UPDATE syntheses_modeles
    SET nom = ?, description = ?, portee = ?, definition_json = ?,
        version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?`)
    .run(nom, payload.description || null, portee, JSON.stringify(payload.definition), row.id);
  return getModele(db, row.id, user);
}

export function archiveModele(db, user, id) {
  const row = findVisibleRow(db, id, user);
  if (!row) throw notFound('Modèle de synthèse introuvable');
  if (row.portee === 'systeme' || row.cle_systeme) {
    throw forbidden('Un modèle système ne peut pas être supprimé');
  }
  if (row.proprietaire_id !== user.id && user.role !== 'admin') throw notFound('Modèle de synthèse introuvable');
  db.prepare(`UPDATE syntheses_modeles
    SET archive = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(row.id);
}

export function duplicateModele(db, user, id, payload = {}) {
  const row = findVisibleRow(db, id, user);
  if (!row) throw notFound('Modèle de synthèse introuvable');
  const base = String(payload.nom || `Copie de ${row.nom}`).trim().slice(0, MAX_NOM) || `Copie de ${row.nom}`;
  const portee = payload.portee === 'equipe' && user.role !== 'lecteur' ? 'equipe' : 'prive';
  const newId = db.prepare(`INSERT INTO syntheses_modeles
    (nom, description, proprietaire_id, portee, definition_json, schema_version, version)
    VALUES (?, ?, ?, ?, ?, ?, 1)`)
    .run(base, row.description, user.id, portee, row.definition_json, row.schema_version).lastInsertRowid;
  return { item: getModele(db, newId, user), source: row.id };
}
