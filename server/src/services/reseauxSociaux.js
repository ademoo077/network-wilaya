import { buildSearchNorm, escapeLike, normalize, normaliserCompteSocial } from '@anm/shared';
import { business, conflict, notFound } from '../utils/errors.js';

export const SOCIAL_FROM = `FROM comptes_sociaux s
  LEFT JOIN dairas da ON da.id=s.daira_id LEFT JOIN communes c ON c.id=s.commune_id`;
const SOCIAL_SELECT = `SELECT s.*, da.name_fr AS ca_fr, da.name_ar AS ca_ar,
  c.name_fr AS commune_fr, c.name_ar AS commune_ar ${SOCIAL_FROM}`;
const SORTS = { nom: 's.nom COLLATE NOCASE', plateforme: 's.plateforme', categorie: 's.categorie',
  ca: "COALESCE(da.name_fr,da.name_ar,NULLIF(s.ca_libelle,'')) COLLATE NOCASE",
  commune: "COALESCE(c.name_fr,c.name_ar,NULLIF(s.commune_libelle,'')) COLLATE NOCASE", updated_at: 's.updated_at' };

/** Liste et statistiques partagent strictement la même population et les mêmes paramètres liés. */
export function socialFilters(query = {}) {
  const conditions = []; const params = [];
  for (const key of ['plateforme', 'categorie', 'verification', 'actif', 'daira_id', 'commune_id']) {
    if (query[key] !== undefined) { conditions.push(`s.${key}=?`); params.push(query[key]); }
  }
  if (query.non_rattache) {
    conditions.push(`s.${query.non_rattache === 'ca' ? 'daira_id' : 'commune_id'} IS NULL`);
    if (!query.daira_id) { conditions.push('s.ca_libelle=?'); params.push(query.ca_libelle || ''); }
    if (query.non_rattache === 'commune') { conditions.push('s.commune_libelle=?'); params.push(query.commune_libelle || ''); }
  }
  if (query.q) {
    conditions.push(`(s.search_norm LIKE ? ESCAPE '\\' OR da.name_fr LIKE ? ESCAPE '\\' OR da.name_ar LIKE ? ESCAPE '\\'
      OR c.name_fr LIKE ? ESCAPE '\\' OR c.name_ar LIKE ? ESCAPE '\\')`);
    params.push(`%${escapeLike(normalize(query.q))}%`, ...Array(4).fill(`%${escapeLike(query.q)}%`));
  }
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

function publicCompte(row) {
  if (!row) return null;
  const { search_norm: _search, ...item } = row;
  return item;
}
export function getCompteSocial(db, id) {
  const row = db.prepare(`${SOCIAL_SELECT} WHERE s.id=?`).get(id);
  if (!row) throw notFound('Compte social introuvable');
  return publicCompte(row);
}
export function listComptesSociaux(db, query) {
  const { where, params } = socialFilters(query);
  const total = db.prepare(`SELECT COUNT(*) AS n ${SOCIAL_FROM} ${where}`).get(...params).n;
  const pageSize = query.pageSize || 25;
  const page = query.page || 1;
  const items = db.prepare(`${SOCIAL_SELECT} ${where} ORDER BY ${SORTS[query.sort] || SORTS.nom} ${query.dir === 'desc' ? 'DESC' : 'ASC'}, s.id ASC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize).map(publicCompte);
  return { items, total, page, pageSize };
}
export function allComptesSociaux(db, query) {
  const { where, params } = socialFilters(query);
  return db.prepare(`${SOCIAL_SELECT} ${where} ORDER BY ${SORTS[query.sort] || SORTS.nom} ${query.dir === 'desc' ? 'DESC' : 'ASC'}, s.id ASC`).all(...params).map(publicCompte);
}

function prepareCompte(db, data) {
  const normalized = normaliserCompteSocial(data.lien_url);
  if (!normalized.ok) throw business('Lien de compte invalide', 'LIEN_COMPTE_INVALIDE', { lien_url: 'Lien HTTP(S) valide requis' });
  if (normalized.plateforme !== data.plateforme) {
    throw business('Le réseau ne correspond pas au lien', 'RESEAU_INCOHERENT', { plateforme: 'Réseau à corriger' });
  }
  let daira = null; let commune = null;
  if (data.daira_id) {
    daira = db.prepare('SELECT * FROM dairas WHERE id=?').get(data.daira_id);
    if (!daira) throw business('CA introuvable', 'TERRITOIRE_INVALIDE', { daira_id: 'CA introuvable' });
  }
  if (data.commune_id) {
    commune = db.prepare('SELECT * FROM communes WHERE id=?').get(data.commune_id);
    if (!commune || commune.daira_id !== daira?.id) {
      throw business('La commune doit appartenir au CA sélectionné', 'TERRITOIRE_INVALIDE', { commune_id: 'Rattachement à corriger' });
    }
  }
  const item = { ...data, lien_url: data.lien_url.trim(), lien_normalise: normalized.url,
    daira_id: daira?.id || null, commune_id: commune?.id || null,
    ca_libelle: daira ? daira.name_fr || daira.name_ar : data.ca_libelle || '',
    commune_libelle: commune ? commune.name_fr || commune.name_ar : data.commune_libelle || '',
    observations: data.observations || '', verification: data.verification || 'a_verifier', actif: data.actif ?? 1 };
  if (item.verification === 'verifie' && !item.nom) throw business('Le nom doit être renseigné avant de vérifier la fiche', 'NOM_COMPTE_REQUIS', { nom: 'Nom requis' });
  item.search_norm = buildSearchNorm([item.nom, item.lien_url, normalized.url, item.plateforme, item.categorie,
    item.ca_libelle, item.commune_libelle, daira?.name_fr, daira?.name_ar, commune?.name_fr, commune?.name_ar, item.observations]);
  return item;
}
function duplicateCompte(db, normalized, except = null) {
  const existing = db.prepare('SELECT id, nom, actif FROM comptes_sociaux WHERE lien_normalise=? AND id<>?').get(normalized, except || 0);
  if (existing) throw conflict('COMPTE_SOCIAL_EXISTANT', 'Ce lien est déjà dans le répertoire, y compris parmi les comptes inactifs', { id: existing.id, nom: existing.nom });
}

/** L'import est le seul chemin autorisant un nom vide, explicitement laissé à vérifier. */
export function createCompteSocial(db, data, userId, provenance = null) {
  return db.transaction(() => {
    const item = prepareCompte(db, data);
    if (!item.nom && !provenance) throw business('Nom requis', 'NOM_COMPTE_REQUIS', { nom: 'Nom requis' });
    duplicateCompte(db, item.lien_normalise);
    const result = db.prepare(`INSERT INTO comptes_sociaux(nom,lien_url,lien_normalise,plateforme,categorie,daira_id,commune_id,
      ca_libelle,commune_libelle,observations,verification,actif,search_norm,cree_par,modifie_par,
      origine,fichier_source,feuille_source,ligne_source,colonne_source,nom_source,ca_source,commune_source)
      VALUES (@nom,@lien_url,@lien_normalise,@plateforme,@categorie,@daira_id,@commune_id,@ca_libelle,@commune_libelle,
      @observations,@verification,@actif,@search_norm,@cree_par,@modifie_par,@origine,@fichier_source,@feuille_source,
      @ligne_source,@colonne_source,@nom_source,@ca_source,@commune_source)`).run({ ...item,
      cree_par: userId || null, modifie_par: userId || null, origine: provenance ? 'excel' : 'manuel',
      fichier_source: provenance?.fichier || null, feuille_source: provenance?.feuille || null,
      ligne_source: provenance?.ligne || null, colonne_source: provenance?.colonne || null,
      nom_source: provenance?.nom ?? null, ca_source: provenance?.ca ?? null, commune_source: provenance?.commune ?? null });
    return getCompteSocial(db, Number(result.lastInsertRowid));
  })();
}
export function updateCompteSocial(db, id, data, userId) {
  return db.transaction(() => {
    const current = getCompteSocial(db, id);
    if (data.version !== current.version) throw conflict('VERSION_CONFLICT', 'Cette fiche a été modifiée. Rechargez-la avant de réessayer.', { current });
    const item = prepareCompte(db, { ...current, ...data });
    duplicateCompte(db, item.lien_normalise, id);
    const result = db.prepare(`UPDATE comptes_sociaux SET nom=@nom,lien_url=@lien_url,lien_normalise=@lien_normalise,
      plateforme=@plateforme,categorie=@categorie,daira_id=@daira_id,commune_id=@commune_id,ca_libelle=@ca_libelle,
      commune_libelle=@commune_libelle,observations=@observations,verification=@verification,actif=@actif,
      search_norm=@search_norm,modifie_par=@userId,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id=@id AND version=@version`).run({ ...item, id, version: data.version, userId });
    if (!result.changes) throw conflict('VERSION_CONFLICT', 'Cette fiche a été modifiée. Rechargez-la avant de réessayer.');
    return getCompteSocial(db, id);
  })();
}
