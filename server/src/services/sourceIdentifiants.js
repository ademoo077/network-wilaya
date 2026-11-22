import { escapeLike, extraireIdentiteSource, normaliserIdentifiant, normalize } from '@anm/shared';
import { badRequest, business, conflict, notFound } from '../utils/errors.js';
import { createCompteSocial } from './reseauxSociaux.js';

export const TYPES_IDENTIFIANT = ['slug', 'id', 'handle', 'canal'];

const SOURCE_SELECT = `SELECT s.*, c.name_fr AS commune_fr, c.name_ar AS commune_ar,
  da.name_fr AS daira_fr, da.name_ar AS daira_ar
  FROM comptes_sociaux s LEFT JOIN communes c ON c.id=s.commune_id
  LEFT JOIN dairas da ON da.id=s.daira_id`;

function publicSource(row) {
  if (!row) return null;
  const { search_norm: _norm, ...item } = row;
  return item;
}

export function identifiantsSource(db, sourceId) {
  return db.prepare(`SELECT id, source_id, reseau, type, valeur, valeur_norm FROM reseaux_identifiants
                     WHERE source_id=? ORDER BY id`).all(sourceId);
}

export function sourcePayload(db, row) {
  return { ...publicSource(row), identifiants: identifiantsSource(db, row.id) };
}

export function sourceParId(db, id, { inclureCorbeille = false } = {}) {
  const row = db.prepare(`${SOURCE_SELECT} WHERE s.id=? ${inclureCorbeille ? '' : 'AND s.deleted_at IS NULL'}`).get(id);
  if (!row) throw notFound('Page introuvable');
  return sourcePayload(db, row);
}

/** Attache un identifiant à une page. Un identifiant appartient à une seule page. */
export function lierIdentifiant(db, { sourceId, reseau, type, valeur, userId }) {
  if (!TYPES_IDENTIFIANT.includes(type)) throw badRequest('Type d’identifiant invalide');
  const valeur_norm = normaliserIdentifiant(type, valeur);
  if (!valeur_norm) throw badRequest('Valeur d’identifiant requise');
  sourceParId(db, sourceId);
  const existant = db.prepare('SELECT * FROM reseaux_identifiants WHERE reseau=? AND type=? AND valeur_norm=?')
    .get(reseau, type, valeur_norm);
  if (existant?.source_id === Number(sourceId)) return { item: existant, created: false };
  if (existant) throw conflict('IDENTIFIANT_DEJA_LIE', 'Cet identifiant appartient à une autre page', { source_id: existant.source_id });
  const result = db.prepare(`INSERT INTO reseaux_identifiants(source_id,reseau,type,valeur,valeur_norm,cree_par)
                             VALUES (?,?,?,?,?,?)`)
    .run(sourceId, reseau, type, String(valeur).trim(), valeur_norm, userId || null);
  return { item: db.prepare('SELECT * FROM reseaux_identifiants WHERE id=?').get(result.lastInsertRowid), created: true };
}

/** Pages correspondant à une identité extraite d'une URL. */
export function sourcesParIdentite(db, identite, { inclureCorbeille = false } = {}) {
  if (identite?.statut !== 'identifie') return [];
  const ids = new Set();
  const filtreSource = inclureCorbeille ? '' : 'AND s.deleted_at IS NULL';
  const filtreDirect = inclureCorbeille ? '' : 'AND deleted_at IS NULL';
  for (const identifiant of identite.identifiants) {
    const rows = db.prepare(`SELECT i.source_id FROM reseaux_identifiants i
      JOIN comptes_sociaux s ON s.id=i.source_id
      WHERE i.reseau=? AND i.type=? AND i.valeur_norm=? ${filtreSource}`)
      .all(identite.reseau, identifiant.type, normaliserIdentifiant(identifiant.type, identifiant.valeur));
    for (const row of rows) ids.add(row.source_id);
  }
  if (identite.page_url) {
    const row = db.prepare(`SELECT id FROM comptes_sociaux WHERE lien_normalise=? ${filtreDirect}`)
      .get(identite.page_url.toLowerCase());
    if (row) ids.add(row.id);
  }
  return [...ids].map((id) => sourcePayload(db, db.prepare(`${SOURCE_SELECT} WHERE s.id=?`).get(id)));
}

/**
 * Recherche normalisée arabe/latin : nom, identifiant, URL, commune.
 * `recents` (ids) permet de remonter les pages récemment choisies sans table d'usage.
 */
export function rechercherSources(db, { q = '', reseau = '', commune_id = null, limit = 12, recents = [] } = {}) {
  const conditions = ['s.deleted_at IS NULL'];
  const params = [];
  if (reseau) { conditions.push('s.plateforme=?'); params.push(reseau); }
  if (commune_id) { conditions.push('s.commune_id=?'); params.push(Number(commune_id)); }
  if (String(q || '').trim()) {
    conditions.push(`(s.search_norm LIKE ? ESCAPE '\\' OR s.nom LIKE ? ESCAPE '\\' OR s.lien_normalise LIKE ? ESCAPE '\\'
      OR c.name_fr LIKE ? ESCAPE '\\' OR c.name_ar LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM reseaux_identifiants i WHERE i.source_id=s.id AND i.valeur_norm LIKE ? ESCAPE '\\'))`);
    const motif = `%${escapeLike(normalize(q))}%`;
    params.push(motif, `%${escapeLike(q)}%`, `%${escapeLike(normalize(q))}%`,
      `%${escapeLike(q)}%`, `%${escapeLike(q)}%`, motif);
  }
  const borne = Math.max(1, Math.min(Number(limit) || 12, 30));
  const idsRecents = [...new Set((Array.isArray(recents) ? recents : []).map(Number).filter(Number.isInteger))].slice(0, 8);
  const ordreRecents = idsRecents.length
    ? `CASE s.id ${idsRecents.map((id, index) => `WHEN ${id} THEN ${index}`).join(' ')} ELSE 99 END, `
    : '';
  const rows = db.prepare(`${SOURCE_SELECT} WHERE ${conditions.join(' AND ')}
    ORDER BY ${ordreRecents}s.nom COLLATE NOCASE ASC, s.id ASC LIMIT ?`).all(...params, borne);
  return rows.map((row) => sourcePayload(db, row));
}

/** Redirections utiles pour la résolution de lien court (jamais obligatoire). */
export function sourceDepuisPageUrl(db, pageUrl) {
  if (!pageUrl) return null;
  const identite = extraireIdentiteSource(pageUrl);
  return sourcesParIdentite(db, identite)[0] || null;
}

/**
 * Crée ou retourne la page. L'identité sert de clé primaire ; l'URL normalisée
 * reste une clé de sécurité contre les doublons. Aucune qualification automatique.
 */
export function creerOuTrouverSource(db, data, user) {
  const reseau = String(data.reseau || 'autre');
  const nature = String(data.nature || 'page');
  if (nature === 'profil' && user?.role !== 'admin') {
    throw business('La création d’un profil est réservée à l’administrateur', 'PROFIL_ADMIN_SEULEMENT',
      { nature: 'Option réservée à l’administrateur' });
  }
  const identifiants = Array.isArray(data.identifiants) ? data.identifiants : [];
  const identite = extraireIdentiteSource(data.page_url || identifiants[0]?.valeur || '');
  if (data.alias_de) {
    const cible = sourceParId(db, data.alias_de);
    for (const identifiant of identifiants) {
      lierIdentifiant(db, { sourceId: cible.id, reseau, type: identifiant.type, valeur: identifiant.valeur, userId: user?.id });
    }
    return { item: cible, created: false, alias: true };
  }
  const existants = [...sourcesParIdentite(db, identite)];
  for (const identifiant of identifiants) {
    const rows = db.prepare(`SELECT source_id FROM reseaux_identifiants WHERE reseau=? AND type=? AND valeur_norm=?`)
      .all(reseau, identifiant.type, normaliserIdentifiant(identifiant.type, identifiant.valeur));
    for (const row of rows) {
      const source = sourceParId(db, row.source_id);
      if (!existants.some((item) => item.id === source.id)) existants.push(source);
    }
  }
  if (existants.length) return { item: existants[0], created: false, similaires: existants.slice(1) };
  const pageUrl = data.page_url || identite.page_url;
  if (!pageUrl) throw badRequest('URL de page ou identifiant requis');
  try {
    const item = createCompteSocial(db, {
      nom: String(data.nom || '').trim(),
      lien_url: pageUrl,
      plateforme: reseau,
      categorie: nature,
      daira_id: data.daira_id || null,
      commune_id: data.commune_id || null,
      observations: String(data.observations || '').trim(),
      verification: 'a_verifier',
      actif: 1,
    }, user?.id);
    for (const identifiant of (identifiants.length ? identifiants : identite.identifiants)) {
      lierIdentifiant(db, { sourceId: item.id, reseau, type: identifiant.type, valeur: identifiant.valeur, userId: user?.id });
    }
    return { item: sourcePayload(db, db.prepare(`${SOURCE_SELECT} WHERE s.id=?`).get(item.id)), created: true };
  } catch (error) {
    // Concurrence : l'unicité de lien_normalise désigne la page gagnante.
    if (String(error?.code || '').includes('CONSTRAINT')) {
      const gagnant = db.prepare('SELECT id FROM comptes_sociaux WHERE lien_normalise=?').get(pageUrl.toLowerCase());
      if (gagnant) return { item: sourceParId(db, gagnant.id), created: false, concurrence: true };
    }
    throw error;
  }
}

/**
 * Rétro-remplissage idempotent (phase 1) : identifiants des pages existantes et
 * rattachement des anomalies dont l'URL correspond déjà à une page connue.
 */
export function backfillSourcesV14(db) {
  const comptes = db.prepare('SELECT id, lien_url, lien_normalise FROM comptes_sociaux').all();
  let identifiants = 0;
  for (const compte of comptes) {
    const identite = extraireIdentiteSource(compte.lien_url);
    if (identite.statut !== 'identifie') continue;
    for (const identifiant of identite.identifiants) {
      const valeur_norm = normaliserIdentifiant(identifiant.type, identifiant.valeur);
      const existe = db.prepare('SELECT id FROM reseaux_identifiants WHERE reseau=? AND type=? AND valeur_norm=?')
        .get(identite.reseau, identifiant.type, valeur_norm);
      if (existe) continue;
      db.prepare(`INSERT INTO reseaux_identifiants(source_id,reseau,type,valeur,valeur_norm)
                  VALUES (?,?,?,?,?)`)
        .run(compte.id, identite.reseau, identifiant.type, identifiant.valeur, valeur_norm);
      identifiants += 1;
    }
  }
  const anomalies = db.prepare(`SELECT id, lien_normalise FROM anomalies
                                WHERE source_reseau_id IS NULL AND lien_normalise IS NOT NULL`).all();
  let rattachees = 0;
  for (const anomalie of anomalies) {
    const source = db.prepare('SELECT id FROM comptes_sociaux WHERE lien_normalise=? AND deleted_at IS NULL')
      .get(anomalie.lien_normalise);
    if (!source) continue;
    db.prepare('UPDATE anomalies SET source_reseau_id=? WHERE id=?').run(source.id, anomalie.id);
    rattachees += 1;
  }
  return { identifiants, rattachees };
}
