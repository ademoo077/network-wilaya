import { buildFilters } from './anomalyQuery.js';

/** Projection légère de tous les points filtrés, sans pièces jointes, historique ou pagination. */
export function anomalyMap(db, params = {}) {
  const base = buildFilters(params);
  const missing = db.prepare(`SELECT COUNT(*) AS n FROM anomalies a ${base.clause}
    AND (a.gps_lat IS NULL OR a.gps_lng IS NULL)`).get(base.values).n;
  const items = db.prepare(`SELECT a.id, a.reference, a.statut, a.priorite, a.verification, a.date_signalement,
    a.gps_lat, a.gps_lng, a.commune_id, a.daira_id, a.domaine_id, a.type_id,
    t.name_ar AS type_ar, t.name_fr AS type_fr, c.name_ar AS commune_ar, c.name_fr AS commune_fr
    FROM anomalies a JOIN types_anomalie t ON t.id = a.type_id JOIN communes c ON c.id = a.commune_id
    ${base.clause} AND a.gps_lat IS NOT NULL AND a.gps_lng IS NOT NULL
    ORDER BY a.date_signalement DESC, a.id DESC`).all(base.values).map(({ gps_lat, gps_lng, ...item }) => ({
    ...item, gps: { lat: gps_lat, lng: gps_lng },
  }));
  return { items, missing, total: items.length + missing };
}
