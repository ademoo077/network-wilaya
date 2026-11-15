import { normaliserUrl } from '@anm/shared';
import { getParams } from '../services/settings.js';
import { notFound } from '../utils/errors.js';

const PURGE_INTERVAL_MS = 20 * 60 * 60 * 1000;

function auditSystem(db, action, details) {
  db.prepare(`INSERT INTO audit_log(user_id, username, action, entite, entite_id, details_json, ip)
    VALUES (NULL, ?, ?, ?, NULL, ?, NULL)`)
    .run('planificateur', action, 'veille_elements', details ? JSON.stringify(details) : null);
}

function readLastPurge(db) {
  return db.prepare("SELECT valeur FROM parametres WHERE cle = 'veille_derniere_purge'").get()?.valeur || null;
}

function writeLastPurge(db, value) {
  db.prepare(`INSERT INTO parametres(cle, valeur) VALUES ('veille_derniere_purge', ?)
    ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur`).run(value);
}

/**
 * Supprime les éléments non retenus arrivés à échéance et efface les champs
 * d'auteur des éléments retenus (liés à une fiche) sans casser le lien.
 */
export function purgeExpired(db, { now = new Date() } = {}) {
  const at = now.toISOString();
  return db.transaction(() => {
    const deleted = db.prepare(`DELETE FROM veille_elements
      WHERE expire_le IS NOT NULL AND expire_le <= ?
        AND statut IN ('nouveau','a_qualifier','rejete','doublon','ignore')`).run(at);
    const anonymized = db.prepare(`UPDATE veille_elements SET auteur_pseudo = NULL, updated_at = ?
      WHERE statut = 'retenu' AND auteur_pseudo IS NOT NULL AND expire_le IS NOT NULL AND expire_le <= ?`)
      .run(at, at);
    return {
      supprimes: deleted.changes,
      anonymises: anonymized.changes,
      dernier_passage: at,
    };
  })();
}

/** Purge quotidienne au démarrage et pendant les ticks du planificateur (au plus toutes les 20 h). */
export function maybePurge(db, { now = new Date(), logger = console, force = false } = {}) {
  const last = readLastPurge(db);
  if (!force && last && now.getTime() - new Date(last).getTime() < PURGE_INTERVAL_MS) return null;
  try {
    const result = purgeExpired(db, { now });
    writeLastPurge(db, result.dernier_passage);
    if (result.supprimes || result.anonymises) {
      auditSystem(db, 'VEILLE_PURGE', result);
      logger.info?.(`Veille — purge : ${result.supprimes} élément(s) supprimé(s), ${result.anonymises} anonymisé(s)`);
    }
    return result;
  } catch (error) {
    logger.warn?.(`Veille — purge impossible : ${error.message}`);
    return null;
  }
}

/** Effacement sur demande (URL ou identifiant), avec trace d'audit. */
export function eraseElements(db, { id = null, url = null, userId = null, username = null, motif = null, now = new Date() } = {}) {
  let rows = [];
  if (id) {
    rows = db.prepare('SELECT id, url FROM veille_elements WHERE id = ?').all(Number(id));
  } else if (url) {
    const normal = normaliserUrl(url);
    const normalized = normal.ok ? normal.url : null;
    rows = normalized
      ? db.prepare('SELECT id, url FROM veille_elements WHERE url_normalise = ? OR url = ?').all(normalized, url)
      : db.prepare('SELECT id, url FROM veille_elements WHERE url = ?').all(url);
  }
  if (!rows.length) throw notFound('Aucun élément Veille ne correspond à cette demande d’effacement');
  const ids = rows.map((row) => Number(row.id));
  const at = now.toISOString();
  db.transaction(() => {
    db.prepare(`DELETE FROM veille_elements WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
    db.prepare(`INSERT INTO audit_log(user_id, username, action, entite, entite_id, details_json, ip)
      VALUES (?, ?, 'VEILLE_EFFACEMENT', 'veille_elements', ?, ?, NULL)`)
      .run(userId, username, String(ids[0]), JSON.stringify({ ids, url: url || null, motif: motif || null, at }));
  })();
  return { elements: ids.length, ids };
}

export function complianceOverview(db, { now = new Date() } = {}) {
  const params = getParams(db);
  const at = now.toISOString();
  const counts = db.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN statut = 'retenu' THEN 1 ELSE 0 END) AS retenus,
      SUM(CASE WHEN auteur_pseudo IS NOT NULL THEN 1 ELSE 0 END) AS pseudonymes,
      SUM(CASE WHEN expire_le IS NOT NULL AND expire_le <= ? THEN 1 ELSE 0 END) AS echus
    FROM veille_elements`).get(at);
  const sources = db.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN config_chiffree IS NOT NULL THEN 1 ELSE 0 END) AS avec_config
    FROM veille_sources`).get();
  const decisions = db.prepare(`SELECT COUNT(*) AS total FROM veille_decisions WHERE annule_le IS NULL`).get().c;
  return {
    parametres: {
      activee: params.veille_activee === '1',
      conservation_jours: Number(params.veille_conservation_jours || 90),
      stocker_auteur: params.veille_stocker_auteur === '1',
      pseudonymiser_auteurs: params.veille_pseudonymiser_auteurs !== '0',
      filtre_geo: params.veille_filtre_geo || 'source_ou_lieu',
    },
    compteurs: {
      elements: counts.total || 0,
      retenus: counts.retenus || 0,
      pseudonymes: counts.pseudonymes || 0,
      echus: counts.echus || 0,
      sources: sources.total || 0,
      sources_avec_config: sources.avec_config || 0,
      decisions: decisions || 0,
    },
    derniere_purge: readLastPurge(db),
  };
}
