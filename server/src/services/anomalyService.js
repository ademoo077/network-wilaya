import db from '../db/database.js';

const SELECT_COLUMNS = `id, reference, plateforme, lien_url, lien_normalise, date_publication, date_signalement, saisi_par, domaine_id, type_id, daira_id, commune_id, adresse_texte, lieu_dit, gps_lat, gps_lng, verification, agent_id, date_verification, statut, epic_id, date_intervention, date_traitement, priorite, observations, deleted_at, created_at, updated_at`;

export function badRequest(message, code = 'INTEGRITY') {
  const err = new Error(message);
  err.status = 400;
  err.code = code;
  return err;
}

export function getAnomalyById(id) {
  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM anomalies WHERE id = ?`).get(id);
  if (!row || row.deleted_at) return null;
  return row;
}

export function generateReference() {
  const year = new Date().getFullYear();
  const row = db.prepare('SELECT COUNT(*) AS c FROM anomalies WHERE reference LIKE ?').get(`ANM-${year}-%`);
  const next = Number(row.c) + 1;
  return `ANM-${year}-${String(next).padStart(5, '0')}`;
}

export function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    const params = [];
    parsed.searchParams.forEach((_v, key) => {
      if (key === 'utm_source' || key === 'utm_medium' || key === 'utm_campaign' || key === 'utm_term' || key === 'utm_content' || key === 'fbclid' || key === 'igshid' || key === 'gclid' || key === 'mc_cid' || key === 'mc_eid') {
        params.push([key, '']);
      }
    });
    const clean = new URL('https://' + parsed.host + parsed.pathname + parsed.search);
    for (const [k, v] of params) clean.searchParams.delete(k);
    const result = clean.toString();
    return result.replace(/\/$/, '') || 'https://';
  } catch {
    return url;
  }
}

export function createAnomaly(input) {
  const type = db.prepare('SELECT id, domaine_id FROM types_anomalie WHERE id = ?').get(input.typeId);
  if (!type || type.domaine_id !== input.domaineId) {
    throw badRequest('Le type d anomalie doit appartenir au domaine choisi');
  }
  const commune = db.prepare('SELECT id, daira_id FROM communes WHERE id = ?').get(input.communeId);
  if (!commune || commune.daira_id !== input.dairaId) {
    throw badRequest('La commune doit appartenir a la daire choisie');
  }

  const statut = input.statut || 'non_traite';
  const epicId = input.epicId ?? null;
  let dateTraitement = input.dateTraitement || null;
  if (statut === 'traite') {
    if (!epicId) throw badRequest('Une anomalie traitee doit etre rattachee a un EPIC');
    if (!dateTraitement) dateTraitement = new Date().toISOString().slice(0, 10);
  }
  if (statut === 'en_cours' && !epicId) throw badRequest('Une anomalie en cours doit etre rattachee a un EPIC');

  const dateSignalement = input.dateSignalement || new Date().toISOString().slice(0, 10);
  if (dateTraitement && dateTraitement < dateSignalement) {
    throw badRequest('La date de traitement doit etre postérieure a la date de signalement');
  }

  const now = new Date().toISOString();
  const info = db.prepare(`INSERT INTO anomalies (reference, plateforme, lien_url, lien_normalise, date_publication, date_signalement, saisi_par, domaine_id, type_id, daira_id, commune_id, adresse_texte, lieu_dit, gps_lat, gps_lng, verification, agent_id, date_verification, statut, epic_id, date_intervention, date_traitement, priorite, observations, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(
      generateReference(),
      input.plateforme,
      input.lienUrl,
      input.lienNormalise ?? normalizeUrl(input.lienUrl),
      input.datePublication ?? null,
      dateSignalement,
      input.saisiPar ?? null,
      input.domaineId,
      input.typeId,
      input.dairaId,
      input.communeId,
      input.adresseTexte ?? null,
      input.lieuDit ?? null,
      input.gpsLat ?? null,
      input.gpsLng ?? null,
      input.verification || 'a_verifier',
      input.agentId ?? null,
      input.dateVerification ?? null,
      statut,
      epicId,
      input.dateIntervention ?? null,
      dateTraitement,
      input.priorite || 'normale',
      input.observations ?? null,
      now,
      now,
    );
  const id = Number(info.lastInsertRowid);
  return getAnomalyById(id);
}

export function updateAnomaly(id, patch, userId) {
  const existing = getAnomalyById(id);
  if (!existing) return null;

  const next = { ...existing };
  const changes = {};
  if (patch.statut !== undefined && patch.statut !== next.statut) {
    changes.statut = { ancien: next.statut, nouveau: patch.statut };
    if (patch.statut === 'traite') {
      next.dateTraitement = patch.dateTraitement || new Date().toISOString().slice(0, 10);
      if (!next.epicId) throw badRequest('Une anomalie traitee doit etre rattachee a un EPIC');
    }
    if (patch.statut === 'en_cours') {
      if (!next.epicId) throw badRequest('Une anomalie en cours doit etre rattachee a un EPIC');
    }
  }

  if (patch.verification !== undefined && patch.verification !== next.verification) {
    changes.verification = { ancien: next.verification, nouveau: patch.verification };
  }
  if (patch.epicId !== undefined && patch.epicId !== next.epicId) {
    changes.epicId = { ancien: next.epicId, nouveau: patch.epicId };
  }
  if (patch.agentId !== undefined && patch.agentId !== next.agentId) {
    changes.agentId = { ancien: next.agentId, nouveau: patch.agentId };
  }

  for (const [champ, change] of Object.entries(changes)) {
    db.prepare('INSERT INTO anomalie_historique (anomalie_id, champ, ancienne_valeur, nouvelle_valeur, user_id, at) VALUES (?, ?, ?, ?, ?, ?)').run(id, champ, change.ancien ?? null, change.nouveau ?? null, userId, new Date().toISOString());
  }

  if (patch.adresseTexte !== undefined) next.adresseTexte = patch.adresseTexte;
  if (patch.lieuDit !== undefined) next.lieuDit = patch.lieuDit;
  if (patch.gpsLat !== undefined) next.gpsLat = patch.gpsLat;
  if (patch.gpsLng !== undefined) next.gpsLng = patch.gpsLng;
  if (patch.observations !== undefined) next.observations = patch.observations;
  if (patch.dateTraitement !== undefined) next.dateTraitement = patch.dateTraitement;
  if (patch.statut !== undefined) next.statut = patch.statut;
  if (patch.verification !== undefined) next.verification = patch.verification;
  if (patch.epicId !== undefined) next.epicId = patch.epicId;
  if (patch.agentId !== undefined) next.agentId = patch.agentId;

  const now = new Date().toISOString();
  db.prepare(`UPDATE anomalies SET plateforme = ?, lien_url = ?, lien_normalise = ?, date_publication = ?, date_signalement = ?, saisi_par = ?, domaine_id = ?, type_id = ?, daira_id = ?, commune_id = ?, adresse_texte = ?, lieu_dit = ?, gps_lat = ?, gps_lng = ?, verification = ?, agent_id = ?, date_verification = ?, statut = ?, epic_id = ?, date_intervention = ?, date_traitement = ?, priorite = ?, observations = ?, updated_at = ? WHERE id = ?`)
    .run(
      next.plateforme, next.lien_url, next.lien_normalise, next.date_publication, next.date_signalement, next.saisi_par, next.domaine_id, next.type_id, next.daira_id, next.commune_id, next.adresse_texte, next.lieu_dit, next.gps_lat, next.gps_lng, next.verification, next.agent_id, next.date_verification, next.statut, next.epicId, next.date_intervention, next.date_traitement, next.priorite, next.observations, now, id,
    );
  return getAnomalyById(id);
}

const SORTABLE_COLUMNS = new Set([
  'id', 'reference', 'plateforme', 'date_publication', 'date_signalement', 'domaine_id', 'type_id', 'daira_id', 'commune_id', 'epic_id', 'agent_id', 'statut', 'priorite', 'gps_lat', 'gps_lng', 'created_at', 'updated_at',
]);

export function listAnomalies(filters, pagination = { page: 1, pageSize: 25 }) {
  const where = [];
  const params = [];
  if (filters.statut) { where.push('statut = ?'); params.push(filters.statut); }
  if (filters.verification) { where.push('verification = ?'); params.push(filters.verification); }
  if (filters.domaineId) { where.push('domaine_id = ?'); params.push(filters.domaineId); }
  if (filters.typeId) { where.push('type_id = ?'); params.push(filters.typeId); }
  if (filters.dairaId) { where.push('daira_id = ?'); params.push(filters.dairaId); }
  if (filters.communeId) { where.push('commune_id = ?'); params.push(filters.communeId); }
  if (filters.epicId) { where.push('epic_id = ?'); params.push(filters.epicId); }
  if (filters.agentId) { where.push('agent_id = ?'); params.push(filters.agentId); }
  if (filters.plateforme) { where.push('plateforme = ?'); params.push(filters.plateforme); }
  if (filters.from) { where.push('date_signalement >= ?'); params.push(filters.from); }
  if (filters.to) { where.push('date_signalement <= ?'); params.push(filters.to); }
  if (filters.q) { where.push('(adresse_texte LIKE ? OR lieu_dit LIKE ? OR lien_url LIKE ? OR observations LIKE ?)'); params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`); }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const sortColumn = SORTABLE_COLUMNS.has(pagination.sort) ? pagination.sort : 'id';
  const sortDir = pagination.order === 'desc' ? 'DESC' : 'ASC';

  const selectAll = `SELECT ${SELECT_COLUMNS} FROM anomalies${whereSql} ORDER BY ${sortColumn} ${sortDir} LIMIT ? OFFSET ?`;
  const rows = db.prepare(selectAll).all(...params, pagination.pageSize, (pagination.page - 1) * pagination.pageSize);
  const totalRow = db.prepare(`SELECT COUNT(*) AS c FROM anomalies${whereSql}`).all(...params);
  const total = Number(totalRow[0].c);
  const page = pagination.page;
  const pageSize = pagination.pageSize;
  return { data: rows, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 } };
}

export function bulkStatus(input) {
  const runUpdate = db.transaction((id, statut, epicId, dateTraitement) => {
    const anomaly = db.prepare('SELECT id, statut, epic_id FROM anomalies WHERE id = ?').get(id);
    if (!anomaly) return { ok: false, id, reason: 'NOT_FOUND' };
    if (anomaly.statut !== statut) {
      db.prepare('INSERT INTO anomalie_historique (anomalie_id, champ, ancienne_valeur, nouvelle_valeur, user_id, at) VALUES (?, ?, ?, ?, ?, ?)').run(id, 'statut', anomaly.statut, statut, input.userId, new Date().toISOString());
    }
    db.prepare('UPDATE anomalies SET statut = ?, epic_id = ?, date_traitement = ?, updated_at = ? WHERE id = ?').run(statut, epicId ?? null, statut === 'traite' ? (dateTraitement || new Date().toISOString().slice(0, 10)) : null, new Date().toISOString(), id);
    return { ok: true, id };
  });
  const results = input.ids.map((id) => runUpdate(id, input.statut, input.epicId, input.dateTraitement));
  return results;
}

export function findDuplicate(url) {
  const normalized = normalizeUrl(url);
  const row = db.prepare('SELECT * FROM anomalies WHERE lien_normalise = ? AND deleted_at IS NULL').get(normalized);
  if (!row) return { duplicate: false };
  const anomaly = getAnomalyById(row.id);
  return { duplicate: true, anomaly };
}

export function getHistorique(anomalieId) {
  const rows = db.prepare('SELECT id, anomalie_id, champ, ancienne_valeur, nouvelle_valeur, user_id, at FROM anomalie_historique WHERE anomalie_id = ? ORDER BY id DESC').all(anomalieId);
  return rows;
}
