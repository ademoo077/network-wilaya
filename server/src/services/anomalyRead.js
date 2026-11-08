import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@anm/shared';
import { buildFilters, orderBy } from './anomalyQuery.js';

export const ANOMALIE_SELECT = `
  SELECT a.*,
         d.name_ar AS domaine_ar, d.name_fr AS domaine_fr,
         t.name_ar AS type_ar, t.name_fr AS type_fr,
         da.name_ar AS daira_ar, da.name_fr AS daira_fr,
         c.name_ar AS commune_ar, c.name_fr AS commune_fr,
         e.name AS epic_name, e.sigle AS epic_sigle,
         ag.full_name AS agent_nom, ag.matricule AS agent_matricule,
         u.full_name AS saisi_par_nom, u.username AS saisi_par_username,
         (SELECT COUNT(*) FROM pieces_jointes p WHERE p.anomalie_id = a.id) AS pieces_count,
         (SELECT COUNT(*) FROM anomalies r WHERE r.lie_a_id = a.id AND r.deleted_at IS NULL) AS repetitions_count,
         parent.reference AS lie_a_reference
  FROM anomalies a
  JOIN domaines d ON d.id = a.domaine_id
  JOIN types_anomalie t ON t.id = a.type_id
  JOIN dairas da ON da.id = a.daira_id
  JOIN communes c ON c.id = a.commune_id
  LEFT JOIN epics e ON e.id = a.epic_id
  LEFT JOIN agents ag ON ag.id = a.agent_id
  LEFT JOIN users u ON u.id = a.saisi_par
  LEFT JOIN anomalies parent ON parent.id = a.lie_a_id
`;

export function serialize(row) {
  if (!row) return null;
  return {
    ...row,
    gps: row.gps_lat === null || row.gps_lat === undefined ? null : { lat: row.gps_lat, lng: row.gps_lng },
    lien_url_sur: row.lien_url && /^https?:\/\//.test(row.lien_url) ? row.lien_url : null,
  };
}

export function getAnomalie(db, id, { includeDeleted = false } = {}) {
  const row = db.prepare(`${ANOMALIE_SELECT} WHERE a.id = ?`).get(id);
  if (!row) return null;
  if (row.deleted_at && !includeDeleted) return null;
  return serialize(row);
}

export function getAnomalieRaw(db, id) {
  return db.prepare('SELECT * FROM anomalies WHERE id = ?').get(id);
}

export function listAnomalies(db, params = {}) {
  const page = Number(params.page) || 1;
  const pageSize = Math.min(Number(params.pageSize) || PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);
  const { clause, values } = buildFilters(params, { trash: params.trash });
  const total = db.prepare(`SELECT COUNT(*) AS c FROM anomalies a ${clause}`).get(values).c;
  const rows = db.prepare(`${ANOMALIE_SELECT} ${clause} ${orderBy(params.sort, params.dir)}
                           LIMIT @limit OFFSET @offset`)
    .all({ ...values, limit: pageSize, offset: (page - 1) * pageSize });
  return { items: rows.map(serialize), page, pageSize, total };
}

export function getHistorique(db, anomalieId) {
  return db.prepare(`SELECT h.*, u.full_name AS user_nom, u.username AS user_username
                     FROM anomalie_historique h
                     LEFT JOIN users u ON u.id = h.user_id
                     WHERE h.anomalie_id = ? ORDER BY h.at ASC, h.id ASC`).all(anomalieId);
}

export function listCorbeille(db, params = {}) {
  return listAnomalies(db, { ...params, trash: true, include_infirmees: true });
}

export function findDuplicateMatches(db, lienNormalise, excludeId = null) {
  return db.prepare(`SELECT a.id, a.reference, a.type_id, a.commune_id, a.statut, a.date_signalement,
                            t.name_ar AS type_ar, t.name_fr AS type_fr,
                            c.name_fr AS commune_fr, c.name_ar AS commune_ar
                     FROM anomalies a
                     JOIN types_anomalie t ON t.id = a.type_id
                     JOIN communes c ON c.id = a.commune_id
                     WHERE a.lien_normalise = ? AND a.deleted_at IS NULL AND a.id <> ?
                     ORDER BY a.id DESC LIMIT 20`).all(lienNormalise, excludeId ?? -1);
}
