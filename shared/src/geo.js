const EARTH_RADIUS_M = 6371008.8;

function validPoint(point) {
  return point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng))
    && Math.abs(Number(point.lat)) <= 90 && Math.abs(Number(point.lng)) <= 180;
}

export function haversineMeters(a, b) {
  if (!validPoint(a) || !validPoint(b)) return null;
  const rad = Math.PI / 180;
  const lat1 = Number(a.lat) * rad;
  const lat2 = Number(b.lat) * rad;
  const dLat = (Number(b.lat) - Number(a.lat)) * rad;
  const dLng = (Number(b.lng) - Number(a.lng)) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function boundingBox(lat, lng, radiusM) {
  const point = { lat: Number(lat), lng: Number(lng) };
  const radius = Number(radiusM);
  if (!validPoint(point) || !Number.isFinite(radius) || radius < 0) return null;
  const latDelta = radius / 111320;
  const cos = Math.max(0.01, Math.cos(point.lat * Math.PI / 180));
  const lngDelta = radius / (111320 * cos);
  return {
    minLat: point.lat - latDelta, maxLat: point.lat + latDelta,
    minLng: point.lng - lngDelta, maxLng: point.lng + lngDelta,
  };
}

export function gridKey(lat, lng, decimals = 3) {
  if (!validPoint({ lat: Number(lat), lng: Number(lng) })) return null;
  const digits = Math.max(0, Math.min(6, Number(decimals) || 0));
  return `${Number(lat).toFixed(digits)},${Number(lng).toFixed(digits)}`;
}

function pointOnSegment(point, a, b, epsilon = 1e-10) {
  const [x, y] = point;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const lengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (lengthSquared <= epsilon) return Math.abs(x - x1) <= epsilon && Math.abs(y - y1) <= epsilon;
  const cross = (y - y1) * (x2 - x1) - (x - x1) * (y2 - y1);
  if (Math.abs(cross) > epsilon) return false;
  const dot = (x - x1) * (x2 - x1) + (y - y1) * (y2 - y1);
  if (dot < -epsilon) return false;
  return dot <= lengthSquared + epsilon;
}

function pointInRing(point, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[j];
    const b = ring[i];
    if (!Array.isArray(a) || !Array.isArray(b)) continue;
    if (pointOnSegment(point, a, b)) return true;
    const intersects = ((b[1] > point[1]) !== (a[1] > point[1]))
      && point[0] < ((a[0] - b[0]) * (point[1] - b[1])) / (a[1] - b[1]) + b[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygonCoordinates(point, coordinates) {
  if (!Array.isArray(coordinates) || !pointInRing(point, coordinates[0])) return false;
  for (let i = 1; i < coordinates.length; i += 1) {
    if (pointInRing(point, coordinates[i])) return false;
  }
  return true;
}

export function pointInGeometry(lat, lng, geometry) {
  if (!validPoint({ lat: Number(lat), lng: Number(lng) }) || !geometry) return false;
  const point = [Number(lng), Number(lat)];
  if (geometry.type === 'Polygon') return pointInPolygonCoordinates(point, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates)
      && geometry.coordinates.some((polygon) => pointInPolygonCoordinates(point, polygon));
  }
  return false;
}

export function geometryBounds(geometry) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return null;
  const points = [];
  const walk = (value) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
      points.push([Number(value[0]), Number(value[1])]); return;
    }
    value.forEach(walk);
  };
  walk(geometry.coordinates);
  if (!points.length) return null;
  return points.reduce((box, [lng, lat]) => ({
    minLat: Math.min(box.minLat, lat), minLng: Math.min(box.minLng, lng),
    maxLat: Math.max(box.maxLat, lat), maxLng: Math.max(box.maxLng, lng), vertices: box.vertices + 1,
  }), { minLat: Infinity, minLng: Infinity, maxLat: -Infinity, maxLng: -Infinity, vertices: 0 });
}
