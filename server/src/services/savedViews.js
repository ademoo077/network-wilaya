import { badRequest, conflict, notFound } from '../utils/errors.js';

const PAGE = 'anomalies';
const MAX_VIEWS = 40;

function normaliseFilters(filters) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return {};
  const clean = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    if (['page', 'pageSize', 'sort', 'dir'].includes(key)) continue;
    clean[key] = String(value).slice(0, 120);
  }
  return clean;
}

function shape(row) {
  return { id: row.id, nom: row.nom, page: row.page, filtres: JSON.parse(row.filtres_json),
    partagee: Boolean(row.partagee), own: Boolean(row.own) };
}

/** Vues personnelles + vues partagées par l'administrateur, sans doublon. */
export function listSavedViews(db, user) {
  const rows = db.prepare(`SELECT v.*, v.user_id = ? AS own FROM vues_sauvegardees v
    WHERE v.page = ? AND (v.user_id = ? OR v.partagee = 1)
    ORDER BY v.updated_at DESC, v.id DESC`).all(user.id, PAGE, user.id);
  return rows.map(shape);
}

export function createSavedView(db, user, payload) {
  const nom = String(payload.nom || '').trim().slice(0, 60);
  if (!nom) throw badRequest('Nom de vue obligatoire', { nom: 'Nom requis' });
  const count = db.prepare('SELECT COUNT(*) AS n FROM vues_sauvegardees WHERE user_id = ? AND page = ?')
    .get(user.id, PAGE).n;
  if (count >= MAX_VIEWS) throw conflict('VUE_LIMITE', `Maximum ${MAX_VIEWS} vues enregistrées`);
  const exists = db.prepare('SELECT id FROM vues_sauvegardees WHERE user_id = ? AND page = ? AND nom = ?')
    .get(user.id, PAGE, nom);
  if (exists) throw conflict('VUE_EXISTE', 'Une vue porte déjà ce nom');
  const filtres = JSON.stringify(normaliseFilters(payload.filtres));
  const partagee = user.role === 'admin' && payload.partagee ? 1 : 0;
  const id = db.prepare(`INSERT INTO vues_sauvegardees(user_id, nom, page, filtres_json, partagee)
    VALUES (?, ?, ?, ?, ?)`).run(user.id, nom, PAGE, filtres, partagee).lastInsertRowid;
  return shape(db.prepare('SELECT v.*, 1 AS own FROM vues_sauvegardees v WHERE v.id = ?').get(id));
}

export function updateSavedView(db, user, id, payload) {
  const row = db.prepare('SELECT * FROM vues_sauvegardees WHERE id = ? AND page = ?').get(Number(id), PAGE);
  if (!row) throw notFound('Vue introuvable');
  if (row.user_id !== user.id) throw notFound('Vue introuvable');
  const nom = payload.nom === undefined ? row.nom : String(payload.nom).trim().slice(0, 60);
  if (!nom) throw badRequest('Nom de vue obligatoire', { nom: 'Nom requis' });
  const filtres = payload.filtres === undefined ? row.filtres_json : JSON.stringify(normaliseFilters(payload.filtres));
  const partagee = user.role === 'admin' && payload.partagee !== undefined ? (payload.partagee ? 1 : 0) : row.partagee;
  db.prepare(`UPDATE vues_sauvegardees SET nom = ?, filtres_json = ?, partagee = ?,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(nom, filtres, partagee, row.id);
  return shape(db.prepare('SELECT v.*, 1 AS own FROM vues_sauvegardees v WHERE v.id = ?').get(row.id));
}

export function deleteSavedView(db, user, id) {
  const row = db.prepare('SELECT * FROM vues_sauvegardees WHERE id = ? AND page = ?').get(Number(id), PAGE);
  if (!row || row.user_id !== user.id) throw notFound('Vue introuvable');
  db.prepare('DELETE FROM vues_sauvegardees WHERE id = ?').run(row.id);
}
