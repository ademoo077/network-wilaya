import { detecterPlateforme, todayAlgiers } from '@anm/shared';
import { conflict, notFound } from '../utils/errors.js';
import { applyLearning } from './learning.js';

const BASE_SELECT = `SELECT e.*, s.type AS source_type, s.nom AS source_nom,
  su.groupe_id, g.name_fr AS groupe_nom, su.domaine_id, d.name_fr AS domaine_nom,
  su.type_id, t.name_fr AS type_nom, su.score AS suggestion_score, su.commune_id, c.name_fr AS commune_nom,
  da.name_fr AS daira_nom,
  (SELECT GROUP_CONCAT(l.terme, ' · ') FROM veille_correspondances co
    JOIN veille_lexique l ON l.id = co.terme_id WHERE co.element_id = e.id) AS termes
  FROM veille_elements e
  JOIN veille_sources s ON s.id = e.source_id
  LEFT JOIN veille_suggestions su ON su.element_id = e.id AND su.rang = 1
  LEFT JOIN groupes_domaines g ON g.id = su.groupe_id
  LEFT JOIN domaines d ON d.id = su.domaine_id
  LEFT JOIN types_anomalie t ON t.id = su.type_id
  LEFT JOIN communes c ON c.id = su.commune_id
  LEFT JOIN dairas da ON da.id = su.daira_id`;

export function listElements(db, query = {}) {
  const where = [];
  const params = [];
  if (query.statut) { where.push('e.statut = ?'); params.push(query.statut); }
  if (query.groupe) { where.push('su.groupe_id = ?'); params.push(query.groupe); }
  if (query.domaine) { where.push('su.domaine_id = ?'); params.push(query.domaine); }
  if (query.commune) { where.push('su.commune_id = ?'); params.push(query.commune); }
  if (query.priorite) { where.push('e.priorite = ?'); params.push(query.priorite); }
  if (query.langue) { where.push('e.langue = ?'); params.push(query.langue); }
  if (query.confiance) { where.push('e.confiance = ?'); params.push(query.confiance); }
  if (query.q) {
    where.push('(e.texte LIKE ? OR e.page_nom LIKE ? OR e.url LIKE ?)');
    const like = `%${query.q}%`;
    params.push(like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || 25);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM veille_elements e
    LEFT JOIN veille_suggestions su ON su.element_id = e.id AND su.rang = 1 ${clause}`).get(...params).c;
  const items = db.prepare(`${BASE_SELECT} ${clause}
    ORDER BY e.priorite = 'urgente' DESC, e.date_publication DESC, e.id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);
  return { items, total, page, pageSize };
}

export function getElement(db, id) {
  const item = db.prepare(`${BASE_SELECT} WHERE e.id = ?`).get(id);
  if (!item) throw notFound('Élément Veille introuvable');
  item.suggestions = db.prepare(`SELECT su.*, g.name_fr AS groupe_nom, d.name_fr AS domaine_nom, t.name_fr AS type_nom
    FROM veille_suggestions su
    LEFT JOIN groupes_domaines g ON g.id = su.groupe_id
    LEFT JOIN domaines d ON d.id = su.domaine_id
    LEFT JOIN types_anomalie t ON t.id = su.type_id
    WHERE su.element_id = ? ORDER BY su.rang`).all(id);
  item.correspondances = db.prepare(`SELECT c.*, l.terme, l.langue, l.role, l.poids
    FROM veille_correspondances c JOIN veille_lexique l ON l.id = c.terme_id
    WHERE c.element_id = ? ORDER BY c.poids_total DESC`).all(id);
  item.decisions = db.prepare(`SELECT d.*, u.full_name AS user_nom FROM veille_decisions d
    LEFT JOIN users u ON u.id = d.user_id WHERE d.element_id = ? ORDER BY d.id DESC`).all(id);
  return item;
}

function snapshot(item) {
  return { statut: item.statut, raison_rejet: item.raison_rejet, traite_par: item.traite_par, traite_le: item.traite_le };
}

export function retainElement(db, id, user, body = {}) {
  const item = getElement(db, id);
  if (item.statut === 'retenu') return { item, prefill: prefillFromElement(db, item) };
  const before = snapshot(item);
  const at = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`UPDATE veille_elements SET statut = 'retenu', raison_rejet = NULL, traite_par = ?, traite_le = ?,
      updated_at = ? WHERE id = ?`).run(user.id, at, at, id);
    db.prepare(`INSERT INTO veille_decisions(element_id, user_id, action, avant_json, apres_json)
      VALUES (?, ?, 'retenir', ?, ?)`).run(id, user.id, JSON.stringify(before),
      JSON.stringify({ statut: 'retenu', commentaire: body.commentaire || null }));
    applyLearning(db, id, 'accept', 1);
  })();
  return { item: getElement(db, id), prefill: prefillFromElement(db, getElement(db, id)) };
}

export function rejectElement(db, id, user, body = {}) {
  const item = getElement(db, id);
  if (item.statut === 'rejete' && item.raison_rejet === (body.raison || 'hors_sujet')) return { item };
  const before = snapshot(item);
  const at = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`UPDATE veille_elements SET statut = 'rejete', raison_rejet = ?, traite_par = ?, traite_le = ?,
      updated_at = ? WHERE id = ?`).run(body.raison || 'hors_sujet', user.id, at, at, id);
    db.prepare(`INSERT INTO veille_decisions(element_id, user_id, action, avant_json, apres_json)
      VALUES (?, ?, 'rejeter', ?, ?)`).run(id, user.id, JSON.stringify(before),
      JSON.stringify({ statut: 'rejete', raison: body.raison || 'hors_sujet', commentaire: body.commentaire || null }));
    applyLearning(db, id, 'reject', 1);
  })();
  return { item: getElement(db, id) };
}

export function undoElement(db, id, user) {
  const decision = db.prepare(`SELECT * FROM veille_decisions WHERE element_id = ? AND annule_le IS NULL
    AND action IN ('retenir', 'rejeter') ORDER BY id DESC LIMIT 1`).get(id);
  if (!decision) throw conflict('RIEN_A_ANNULER', "Aucune décision à annuler pour cet élément");
  const before = JSON.parse(decision.avant_json || '{}');
  const at = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`UPDATE veille_elements SET statut = ?, raison_rejet = ?, traite_par = ?, traite_le = ?, updated_at = ?
      WHERE id = ?`).run(before.statut, before.raison_rejet, before.traite_par, before.traite_le, at, id);
    db.prepare('UPDATE veille_decisions SET annule_le = ?, annule_par = ? WHERE id = ?').run(at, user.id, decision.id);
    applyLearning(db, id, decision.action === 'retenir' ? 'accept' : 'reject', -1);
  })();
  return { item: getElement(db, id) };
}

export function prefillFromElement(db, item) {
  const top = item.suggestions?.[0] || item;
  let domaineId = top.domaine_id || null; let typeId = top.type_id || null;
  if (!typeId && db) {
    for (const match of item.correspondances || []) {
      if (match.role === 'exclusion') continue;
      const found = db.prepare(`SELECT id, domaine_id FROM types_anomalie WHERE actif = 1
        AND (name_fr LIKE ? OR name_ar LIKE ?) ORDER BY LENGTH(name_fr) LIMIT 1`)
        .get(`%${match.terme}%`, `%${match.terme}%`);
      if (found) { typeId = found.id; domaineId = found.domaine_id; break; }
    }
  }
  if (!domaineId && db && top.groupe_id) {
    domaineId = db.prepare('SELECT id FROM domaines WHERE groupe_id = ? AND actif = 1 ORDER BY ordre, id LIMIT 1')
      .get(top.groupe_id)?.id || null;
  }
  if (!typeId && db && domaineId) {
    typeId = db.prepare('SELECT id FROM types_anomalie WHERE domaine_id = ? AND actif = 1 ORDER BY ordre, id LIMIT 1')
      .get(domaineId)?.id || null;
  }
  let plateforme = 'autre';
  if (item.url) {
    try { plateforme = detecterPlateforme(new URL(item.url).hostname); } catch { plateforme = 'autre'; }
  }
  const date = String(item.date_publication || '').slice(0, 10);
  return {
    veille_element_id: item.id,
    lien_url: item.url || '',
    plateforme: plateforme === 'facebook' || plateforme === 'instagram' || plateforme === 'youtube' ? plateforme : 'autre',
    date_publication: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayAlgiers(),
    domaine_id: domaineId || '',
    type_id: typeId || '',
    commune_id: top.commune_id || '',
    daira_id: top.daira_id || '',
    priorite: item.priorite || 'normale',
    legende: item.texte,
    observations: `Veille citoyenne — ${item.page_nom || item.source_nom || 'source inconnue'}${item.url ? `\n${item.url}` : ''}`,
    gps: item.gps_lat && item.gps_lng ? { lat: item.gps_lat, lng: item.gps_lng } : null,
  };
}
