import { boundingBox, haversineMeters, pointInGeometry } from '@anm/shared';

function boxValues(lat, lng, radius) {
  const box = boundingBox(lat, lng, radius);
  return { lat: Number(lat), lng: Number(lng), minLat: box.minLat, maxLat: box.maxLat, minLng: box.minLng, maxLng: box.maxLng };
}

function territoryResult(row, method, confidence) {
  if (!row) return { methode: null };
  return {
    commune_id: row.commune_id,
    daira_id: row.daira_id,
    methode: method,
    confiance: confidence,
    commune: { id: row.commune_id, name_fr: row.commune_fr, name_ar: row.commune_ar },
    daira: { id: row.daira_id, name_fr: row.daira_fr, name_ar: row.daira_ar },
  };
}

export function locateByPolygon(db, lat, lng) {
  const candidates = db.prepare(`SELECT l.commune_id, l.geojson, c.daira_id,
      c.name_fr AS commune_fr, c.name_ar AS commune_ar,
      d.name_fr AS daira_fr, d.name_ar AS daira_ar
    FROM limites_communes l
    JOIN communes c ON c.id = l.commune_id
    JOIN dairas d ON d.id = c.daira_id
    WHERE @lat BETWEEN l.min_lat AND l.max_lat AND @lng BETWEEN l.min_lng AND l.max_lng`).all({ lat, lng });
  for (const row of candidates) {
    try {
      if (pointInGeometry(lat, lng, JSON.parse(row.geojson))) return territoryResult(row, 'polygone', 'haute');
    } catch { /* une limite corrompue est ignorée, l'import la prévient */ }
  }
  return null;
}

export function locateByNeighbors(db, lat, lng, radius = 300) {
  const values = boxValues(lat, lng, radius);
  const candidates = db.prepare(`SELECT a.gps_lat, a.gps_lng, a.commune_id,
      c.daira_id, c.name_fr AS commune_fr, c.name_ar AS commune_ar,
      d.name_fr AS daira_fr, d.name_ar AS daira_ar
    FROM anomalies a
    JOIN communes c ON c.id = a.commune_id
    JOIN dairas d ON d.id = c.daira_id
    WHERE a.deleted_at IS NULL AND a.gps_lat BETWEEN @minLat AND @maxLat
      AND a.gps_lng BETWEEN @minLng AND @maxLng`).all(values)
    .filter((row) => haversineMeters(values, { lat: row.gps_lat, lng: row.gps_lng }) <= radius);
  if (candidates.length < 2) return null;
  const counts = new Map();
  for (const row of candidates) {
    const entry = counts.get(row.commune_id) || { count: 0, row };
    entry.count += 1;
    counts.set(row.commune_id, entry);
  }
  const winner = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  if (!winner || winner.count < 2 || winner.count / candidates.length < 0.6) return null;
  return { ...territoryResult(winner.row, 'voisinage', 'moyenne'), voisins: candidates.length, majorite: winner.count };
}

export function locatePoint(db, lat, lng) {
  return locateByPolygon(db, lat, lng) || locateByNeighbors(db, lat, lng) || { methode: null };
}

export function nearbyAnomalies(db, options) {
  const radius = Number(options.radius) || 150;
  const values = boxValues(options.lat, options.lng, radius);
  const conditions = [
    'a.deleted_at IS NULL', 'a.gps_lat BETWEEN @minLat AND @maxLat', 'a.gps_lng BETWEEN @minLng AND @maxLng',
  ];
  if (options.type) { conditions.push('a.type_id = @type'); values.type = Number(options.type); }
  else if (options.domaine) { conditions.push('a.domaine_id = @domaine'); values.domaine = Number(options.domaine); }
  if (options.exclude) { conditions.push('a.id <> @exclude'); values.exclude = Number(options.exclude); }
  return db.prepare(`SELECT a.id, a.reference, a.statut, a.priorite, a.verification,
      a.type_id, a.domaine_id, a.commune_id, a.gps_lat, a.gps_lng, a.date_signalement,
      t.name_fr AS type_fr, t.name_ar AS type_ar, c.name_fr AS commune_fr, c.name_ar AS commune_ar
    FROM anomalies a
    JOIN types_anomalie t ON t.id = a.type_id
    JOIN communes c ON c.id = a.commune_id
    WHERE ${conditions.join(' AND ')}`).all(values)
    .map((row) => ({
      ...row,
      gps: { lat: row.gps_lat, lng: row.gps_lng },
      distance_m: Math.round(haversineMeters(values, { lat: row.gps_lat, lng: row.gps_lng }) * 10) / 10,
    }))
    .filter((row) => row.distance_m <= radius)
    .sort((a, b) => a.distance_m - b.distance_m);
}
