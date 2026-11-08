import { geometryBounds, normalize } from '@anm/shared';
import { badRequest, business } from '../utils/errors.js';

const MAX_FEATURES = 5000;
const MAX_VERTICES = 500000;

function parseJson(buffer) {
  try { return JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, '')); }
  catch { throw badRequest('GeoJSON invalide ou illisible'); }
}

function validateGeometry(geometry) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return { error: 'Polygon ou MultiPolygon attendu' };
  const bounds = geometryBounds(geometry);
  if (!bounds || bounds.vertices < 4) return { error: 'Géométrie vide ou invalide' };
  if (bounds.minLat < -90 || bounds.maxLat > 90 || bounds.minLng < -180 || bounds.maxLng > 180) {
    return { error: 'Coordonnées hors plage' };
  }
  return { bounds };
}

function communeIndex(db) {
  const index = new Map();
  const rows = db.prepare(`SELECT c.id, c.name_fr, c.name_ar, c.daira_id, d.name_fr AS daira_fr
                           FROM communes c JOIN dairas d ON d.id = c.daira_id`).all();
  for (const row of rows) {
    for (const name of [row.name_fr, row.name_ar].filter(Boolean)) {
      const key = normalize(name);
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(row);
    }
  }
  return { index, byId: new Map(rows.map((row) => [row.id, row])) };
}

function readMapping(value) {
  if (!value) return {};
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { throw badRequest('Correspondances manuelles invalides'); }
}

function mergedGeometry(geometries) {
  const polygons = geometries.flatMap((geometry) => geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates);
  return polygons.length === 1
    ? { type: 'Polygon', coordinates: polygons[0] }
    : { type: 'MultiPolygon', coordinates: polygons };
}

export function importGeoJson(db, buffer, options = {}) {
  const payload = parseJson(buffer);
  if (payload.type !== 'FeatureCollection' || !Array.isArray(payload.features)) {
    throw badRequest('Une FeatureCollection GeoJSON est attendue');
  }
  if (!payload.features.length) throw business('Le GeoJSON ne contient aucune limite');
  if (payload.features.length > MAX_FEATURES) throw badRequest(`Maximum ${MAX_FEATURES} entités`);
  const property = String(options.property || '').trim();
  const properties = [...new Set(payload.features.slice(0, 100).flatMap((feature) => Object.keys(feature.properties || {})))].sort();
  if (!property) return { applied: false, requiresProperty: true, properties, summary: { total: payload.features.length } };
  const mapping = readMapping(options.mapping);
  const communes = communeIndex(db);
  let totalVertices = 0;
  const rows = payload.features.map((feature, index) => {
    const geometryCheck = validateGeometry(feature.geometry);
    if (geometryCheck.error) return { index, name: null, status: 'error', message: geometryCheck.error };
    totalVertices += geometryCheck.bounds.vertices;
    const name = String(feature.properties?.[property] ?? '').trim();
    const manualId = Number(mapping[index]) || null;
    const natural = name ? communes.index.get(normalize(name)) || [] : [];
    const matches = manualId ? [communes.byId.get(manualId)].filter(Boolean) : natural;
    if (!name && !manualId) return { index, name, status: 'error', message: `Propriété « ${property} » absente` };
    if (!matches.length) return { index, name, status: 'unmatched', message: 'Commune non appariée' };
    if (matches.length > 1) return { index, name, status: 'ambiguous', message: 'Nom de commune ambigu', choices: matches };
    return { index, name, status: 'matched', commune: matches[0], geometry: feature.geometry, bounds: geometryCheck.bounds };
  });
  if (totalVertices > MAX_VERTICES) throw badRequest(`Maximum ${MAX_VERTICES} sommets`);
  const matched = rows.filter((row) => row.status === 'matched');
  const summary = {
    total: rows.length, matched: matched.length,
    unmatched: rows.filter((row) => row.status === 'unmatched').length,
    ambiguous: rows.filter((row) => row.status === 'ambiguous').length,
    errors: rows.filter((row) => row.status === 'error').length,
    vertices: totalVertices,
  };
  if (!options.commit) {
    return {
      applied: false, properties, summary,
      rows: rows.map(({ geometry: _geometry, bounds: _bounds, ...row }) => row),
      preview: { type: 'FeatureCollection', features: matched.map((row) => ({ type: 'Feature', properties: { commune_id: row.commune.id, name: row.name }, geometry: row.geometry })) },
    };
  }
  if (!matched.length) throw business('Aucune limite appariée à enregistrer', 'LIMITES_SANS_CORRESPONDANCE');
  const byCommune = new Map();
  for (const row of matched) {
    if (!byCommune.has(row.commune.id)) byCommune.set(row.commune.id, []);
    byCommune.get(row.commune.id).push(row.geometry);
  }
  const upsert = db.prepare(`INSERT INTO limites_communes(commune_id,geojson,min_lat,min_lng,max_lat,max_lng)
    VALUES (@commune_id,@geojson,@minLat,@minLng,@maxLat,@maxLng)
    ON CONFLICT(commune_id) DO UPDATE SET geojson=excluded.geojson,min_lat=excluded.min_lat,
      min_lng=excluded.min_lng,max_lat=excluded.max_lat,max_lng=excluded.max_lng,
      updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`);
  db.transaction(() => {
    for (const [communeId, geometries] of byCommune) {
      const geometry = mergedGeometry(geometries);
      upsert.run({ commune_id: communeId, geojson: JSON.stringify(geometry), ...geometryBounds(geometry) });
    }
  })();
  return { applied: true, properties, summary: { ...summary, saved: byCommune.size }, rows: rows.map(({ geometry: _geometry, bounds: _bounds, ...row }) => row) };
}
