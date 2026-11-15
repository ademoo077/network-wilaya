import { percentile } from '@anm/shared';
import { computePeaks } from './stats.js';

const HOUR_MS = 3600000;
const LAST_RUN = new WeakMap();

function iso(date = new Date()) { return date.toISOString(); }

function dedupe(db, { regle, cle, now, hours = 12 }) {
  if (!cle) return false;
  const since = iso(new Date(now.getTime() - hours * HOUR_MS));
  return Boolean(db.prepare(`SELECT id FROM veille_alertes
    WHERE regle = ? AND details_json LIKE ? AND created_at >= ? LIMIT 1`)
    .get(regle, `%"cle":"${cle}"%`, since));
}

function addAlert(db, { regle, gravite, titre, details = null, now = new Date() }) {
  if (dedupe(db, { regle, cle: details?.cle, now })) return false;
  db.prepare(`INSERT INTO veille_alertes(regle, gravite, titre, details_json, created_at)
    VALUES (?, ?, ?, ?, ?)`).run(regle, gravite, String(titre).slice(0, 300),
    details ? JSON.stringify(details) : null, iso(now));
  return true;
}

/** Génère les alertes de veille (source en erreur, jeton, attente, termes critiques, viralité, pics). */
export function generateAlerts(db, { now = new Date() } = {}) {
  let created = 0;
  const at = now.toISOString();

  const sources = db.prepare(`SELECT s.id, s.nom, s.dernier_statut, s.dernier_message, s.jeton_expire_le,
      j.statut AS job_statut, j.erreur_code, j.erreur_message
    FROM veille_sources s LEFT JOIN veille_jobs j ON j.source_id = s.id
    WHERE s.actif = 1 AND (s.dernier_statut = 'error' OR j.statut IN ('error', 'backoff')) LIMIT 10`).all();
  for (const source of sources) {
    if (addAlert(db, {
      regle: 'source_erreur', gravite: 'avertissement', now,
      titre: `Source en erreur : ${source.nom}`,
      details: {
        cle: `source-${source.id}`, source_id: source.id, source: source.nom,
        code: source.erreur_code || null, message: source.erreur_message || source.dernier_message || null,
      },
    })) created += 1;
  }

  const tokens = db.prepare(`SELECT id, nom, jeton_expire_le FROM veille_sources
    WHERE actif = 1 AND jeton_expire_le IS NOT NULL AND jeton_expire_le <= ?`).all(iso(new Date(now.getTime() + 7 * 24 * HOUR_MS)));
  for (const source of tokens) {
    const expired = new Date(source.jeton_expire_le).getTime() < now.getTime();
    if (addAlert(db, {
      regle: 'jeton_expiration', gravite: expired ? 'critique' : 'avertissement', now,
      titre: `${expired ? 'Jeton expiré' : 'Jeton proche de l’expiration'} : ${source.nom}`,
      details: { cle: `jeton-${source.id}-${String(source.jeton_expire_le).slice(0, 10)}`, source_id: source.id, expire_le: source.jeton_expire_le },
    })) created += 1;
  }

  const pending = db.prepare(`SELECT COUNT(*) AS c FROM veille_elements
    WHERE statut = 'a_qualifier' AND collecte_le < ?`).get(iso(new Date(now.getTime() - 48 * HOUR_MS))).c;
  if (pending > 0) {
    const day = at.slice(0, 10);
    if (addAlert(db, {
      regle: 'attente_qualification', gravite: 'info', now,
      titre: `${pending} élément(s) à qualifier depuis plus de 48 h`,
      details: { cle: `attente-${day}`, count: pending },
    })) created += 1;
  }

  const critical = db.prepare(`SELECT e.id, e.texte, l.terme, l.groupe_id
    FROM veille_elements e
    JOIN veille_correspondances vc ON vc.element_id = e.id
    JOIN veille_lexique l ON l.id = vc.terme_id
    WHERE e.collecte_le >= ? AND e.statut IN ('a_qualifier','nouveau') AND l.role = 'urgence'
    ORDER BY e.priorite = 'urgente' DESC, e.score DESC LIMIT 5`).all(iso(new Date(now.getTime() - 24 * HOUR_MS)));
  for (const element of critical) {
    if (addAlert(db, {
      regle: 'terme_critique', gravite: 'critique', now,
      titre: `Terme critique « ${element.terme} » : ${String(element.texte).slice(0, 90)}`,
      details: { cle: `critique-${element.id}`, element_id: element.id, terme: element.terme },
    })) created += 1;
  }

  const recent = db.prepare(`SELECT id, page_nom, viralite FROM veille_elements
    WHERE collecte_le >= ? AND statut IN ('a_qualifier','nouveau') AND viralite IS NOT NULL
    ORDER BY viralite DESC LIMIT 100`).all(iso(new Date(now.getTime() - 24 * HOUR_MS)));
  if (recent.length >= 5) {
    const threshold = percentile(recent.map((row) => row.viralite), 0.9);
    for (const element of recent.filter((row) => Number(row.viralite) >= threshold && Number(row.viralite) > 0).slice(0, 3)) {
      if (addAlert(db, {
        regle: 'publication_virale', gravite: 'avertissement', now,
        titre: `Publication virale (${Math.round(Number(element.viralite))}) : ${element.page_nom || 'source inconnue'}`,
        details: { cle: `virale-${element.id}`, element_id: element.id, page_nom: element.page_nom || null },
      })) created += 1;
    }
  }

  for (const peak of computePeaks(db, { now })) {
    const day = at.slice(0, 10);
    if (addAlert(db, {
      regle: 'pic_activite', gravite: 'avertissement', now,
      titre: `Pic d’activité : ${peak.groupe_fr || peak.groupe_id} · ${peak.commune_fr || peak.commune_id}`,
      details: {
        cle: `pic-${peak.groupe_id}-${peak.commune_id}-${day}`, groupe_id: peak.groupe_id,
        commune_id: peak.commune_id, z: peak.z, total_7j: peak.total_7j,
        groupe_fr: peak.groupe_fr, groupe_ar: peak.groupe_ar,
        commune_fr: peak.commune_fr, commune_ar: peak.commune_ar,
      },
    })) created += 1;
  }

  return created;
}

/** Rafraîchit au plus une fois par minute (appelé par le statut, la cloche et le planificateur). */
export function refreshAlerts(db, { now = new Date(), minIntervalMs = 60000, force = false } = {}) {
  const key = db;
  const last = LAST_RUN.get(key) || 0;
  if (!force && now.getTime() - last < minIntervalMs) return 0;
  LAST_RUN.set(key, now.getTime());
  try { return generateAlerts(db, { now }); } catch { return 0; }
}

export function listAlerts(db, { unreadOnly = false, limit = 30 } = {}) {
  const capped = Math.max(1, Math.min(100, Number(limit) || 30));
  const rows = db.prepare(`SELECT id, regle, gravite, titre, details_json, lue, created_at
    FROM veille_alertes ${unreadOnly ? 'WHERE lue = 0' : ''} ORDER BY created_at DESC, id DESC LIMIT ?`).all(capped);
  return rows.map((row) => {
    let details = null;
    try { details = row.details_json ? JSON.parse(row.details_json) : null; } catch { details = null; }
    return { ...row, details };
  });
}

export function markAlertRead(db, id) {
  return db.prepare('UPDATE veille_alertes SET lue = 1 WHERE id = ?').run(Number(id)).changes > 0;
}

export function markAllAlertsRead(db) {
  return db.prepare('UPDATE veille_alertes SET lue = 1 WHERE lue = 0').run().changes;
}
