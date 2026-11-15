import { isNearDuplicate, normaliserUrl, viraliteScore } from '@anm/shared';
import { getParams } from '../services/settings.js';
import { hashToken, pseudonymize } from './secrets.js';
import { analyserElement, saveAnalysis } from './analyze.js';

function iso(date = new Date()) { return date.toISOString(); }

function safeUrl(raw) {
  if (!raw) return { url: null, url_normalise: null };
  const parsed = normaliserUrl(raw);
  return parsed.ok ? { url: String(raw).trim(), url_normalise: parsed.url } : { url: String(raw).trim(), url_normalise: null };
}

export function createVeilleElement(db, sourceId, raw, { context, now = new Date(), viral = false } = {}) {
  const params = context?.params || getParams(db);
  const texte = String(raw.texte || '').trim().slice(0, 10000);
  if (!texte) throw new Error('Texte vide : élément Veille ignoré');
  const links = safeUrl(raw.url);
  const idExterne = String(raw.id_externe || links.url_normalise || hashToken(`${sourceId}|${texte}`)).slice(0, 500);
  const expireLe = iso(new Date(now.getTime() + Number(params.veille_conservation_jours || 90) * 86400000));
  const pseudo = params.veille_stocker_auteur === '1' && raw.auteur && params.veille_pseudonymiser_auteurs !== '0'
    ? pseudonymize(raw.auteur) : null;
  const result = db.prepare(`INSERT OR IGNORE INTO veille_elements
    (source_id, id_externe, url, url_normalise, page_nom, auteur_pseudo, texte, texte_norm,
     date_publication, collecte_le, type_media, metriques_json, viralite, gps_lat, gps_lng, expire_le)
    VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(sourceId, idExterne, links.url, links.url_normalise, raw.page_nom || null, pseudo, texte,
      raw.date_publication || null, iso(now), raw.type_media || null,
      raw.metriques ? JSON.stringify(raw.metriques) : null,
      raw.metriques ? viraliteScore(raw.metriques) : null,
      raw.gps?.lat ?? null, raw.gps?.lng ?? null, expireLe);
  const existing = result.changes ? null : db.prepare(`SELECT * FROM veille_elements
    WHERE source_id = ? AND id_externe = ?`).get(sourceId, idExterne);
  if (existing) return { element: existing, created: false, analysis: null };
  const elementId = Number(result.lastInsertRowid);
  const analysis = analyserElement(raw, context, { viral });
  saveAnalysis(db, elementId, analysis);
  attachDuplicateAndEvent(db, elementId, analysis, now);
  const element = db.prepare('SELECT * FROM veille_elements WHERE id = ?').get(elementId);
  return { element, created: true, analysis };
}

export function attachDuplicateAndEvent(db, elementId, analysis, now = new Date()) {
  const element = db.prepare('SELECT * FROM veille_elements WHERE id = ?').get(elementId);
  if (!element) return null;
  const params = getParams(db);
  const windowHours = Number(params.veille_fenetre_doublon_h || 72);
  const cutoff = iso(new Date(now.getTime() - windowHours * 3600000));
  let canonical = null;
  let reason = null;
  if (element.url_normalise) {
    const sameUrl = db.prepare(`SELECT id, groupe_doublon_id FROM veille_elements
      WHERE url_normalise = ? AND id <> ? ORDER BY id LIMIT 1`).get(element.url_normalise, elementId);
    if (sameUrl) { canonical = sameUrl.groupe_doublon_id || sameUrl.id; reason = 'doublon_url'; }
  }
  if (!canonical && element.simhash) {
    const recent = db.prepare(`SELECT id, simhash, groupe_doublon_id FROM veille_elements
      WHERE simhash IS NOT NULL AND id <> ? AND collecte_le >= ? ORDER BY id DESC LIMIT 500`).all(elementId, cutoff);
    const near = recent.find((row) => isNearDuplicate(row.simhash, element.simhash, 3));
    if (near) { canonical = near.groupe_doublon_id || near.id; reason = 'doublon_simhash'; }
  }
  db.prepare(`UPDATE veille_elements SET groupe_doublon_id = ?, statut = CASE WHEN ? IS NOT NULL AND statut <> 'ignore'
    THEN 'doublon' ELSE statut END, raison_rejet = COALESCE(raison_rejet, ?), updated_at = ? WHERE id = ?`)
    .run(canonical, reason, reason, iso(now), elementId);
  const top = analysis?.suggestions?.[0];
  const event = top?.groupe_id && analysis?.territoire?.commune_id
    ? attachEvent(db, { element, top, territory: analysis.territoire, now, reason }) : null;
  return { canonical, reason, event };
}

function attachEvent(db, { element, top, territory, now, reason }) {
  const at = iso(now);
  const cutoff = iso(new Date(now.getTime() - 48 * 3600000));
  let event = db.prepare(`SELECT * FROM veille_evenements WHERE groupe_id = ? AND commune_id = ?
    AND fin >= ? AND debut <= ? ORDER BY id DESC LIMIT 1`)
    .get(top.groupe_id, territory.commune_id, cutoff, at);
  if (!event) {
    const id = Number(db.prepare(`INSERT INTO veille_evenements(groupe_id, commune_id, debut, fin, nb_elements, nb_sources, score, priorite)
      VALUES (?, ?, ?, ?, 1, 1, ?, ?)`).run(top.groupe_id, territory.commune_id, at, at, top.score, element.priorite).lastInsertRowid);
    event = db.prepare('SELECT * FROM veille_evenements WHERE id = ?').get(id);
  } else {
    db.prepare('UPDATE veille_evenements SET fin = ?, nb_elements = nb_elements + 1, score = MAX(score, ?), priorite = ? WHERE id = ?')
      .run(at, top.score, element.priorite, event.id);
  }
  db.prepare(`UPDATE veille_elements SET evenement_id = ? WHERE id = ?`).run(event.id, element.id);
  const sources = db.prepare('SELECT COUNT(DISTINCT source_id) AS c FROM veille_elements WHERE evenement_id = ?').get(event.id).c;
  db.prepare('UPDATE veille_evenements SET nb_sources = ? WHERE id = ?').run(sources, event.id);
  db.prepare('UPDATE veille_elements SET nb_sources = ? WHERE id = ?').run(sources, element.id);
  if (reason) db.prepare('UPDATE veille_elements SET nb_sources = ? WHERE id = ?').run(sources, element.id);
  return event;
}
