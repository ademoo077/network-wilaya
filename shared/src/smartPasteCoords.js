const DIRECTIONS = {
  n: 1, north: 1, 'ش': 1, 'شمال': 1,
  s: -1, south: -1, 'ج': -1, 'جنوب': -1,
  e: 1, east: 1, 'شرق': 1,
  w: -1, west: -1, 'غرب': -1,
};

function decimalPlaces(raw) {
  const part = String(raw).replace(',', '.').split('.')[1];
  return part ? part.replace(/\D.*$/, '').length : 0;
}

function inBbox(lat, lng, bbox) {
  if (!bbox) return true;
  const values = String(bbox).split(',').map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return true;
  return lat >= values[0] && lat <= values[2] && lng >= values[1] && lng <= values[3];
}

export function makeCoordinate(latRaw, lngRaw, source = 'manuel', options = {}) {
  let lat = Number(String(latRaw).replace(',', '.'));
  let lng = Number(String(lngRaw).replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  let inversionProposee = false;
  if (Math.abs(lat) > 90 && Math.abs(lat) <= 180 && Math.abs(lng) <= 90) {
    [lat, lng] = [lng, lat];
    inversionProposee = true;
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  lat = Math.round(lat * 1e6) / 1e6;
  lng = Math.round(lng * 1e6) / 1e6;
  const decimals = Math.min(decimalPlaces(latRaw), decimalPlaces(lngRaw));
  const precision = decimals ? Math.max(1, Math.round(111320 / (10 ** decimals))) : null;
  return {
    lat, lng, source, confiance: inversionProposee ? 'moyenne' : 'haute',
    ...(precision ? { precision_m: precision } : {}),
    ...(inversionProposee ? { inversionProposee: true } : {}),
    ...(!inBbox(lat, lng, options.bbox) ? { hors_zone: true } : {}),
  };
}

function pair(value) {
  const decoded = decodeURIComponent(String(value || '').replace(/\+/g, ' '));
  const match = decoded.match(/(-?\d{1,3}(?:[.,]\d+)?)\s*[,;، ]\s*(-?\d{1,3}(?:[.,]\d+)?)/);
  return match ? [match[1], match[2]] : null;
}

function firstPair(candidates) {
  for (const candidate of candidates) if (candidate) return candidate;
  return null;
}

export function coordinateFromMapUrl(raw, options = {}) {
  if (/^geo:/i.test(raw)) {
    const values = pair(raw.slice(4));
    return values ? makeCoordinate(values[0], values[1], 'lien_carte', options) : null;
  }
  let url;
  try { url = new URL(/^https?:/i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  const text = decodeURIComponent(url.href);
  const pin = text.match(/!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/);
  const osm = url.searchParams.get('mlat') && url.searchParams.get('mlon')
    ? [url.searchParams.get('mlat'), url.searchParams.get('mlon')] : null;
  const hash = url.hash.match(/#map=\d+(?:\.\d+)?\/(-?\d{1,3}(?:\.\d+)?)\/(-?\d{1,3}(?:\.\d+)?)/);
  const at = text.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)(?:,|\/|$)/);
  const values = firstPair([
    pin ? [pin[1], pin[2]] : null,
    pair(url.searchParams.get('q')), pair(url.searchParams.get('query')),
    pair(url.searchParams.get('ll')), osm,
    hash ? [hash[1], hash[2]] : null,
    at ? [at[1], at[2]] : null,
  ]);
  return values ? makeCoordinate(values[0], values[1], 'lien_carte', options) : null;
}

function dms(degrees, minutes, seconds, direction) {
  const sign = DIRECTIONS[String(direction).toLowerCase()];
  if (!sign) return null;
  const value = Number(degrees) + Number(minutes || 0) / 60 + Number(seconds || 0) / 3600;
  return sign * value;
}

export function extractCoordinatesFromText(value, options = {}) {
  const text = String(value || '').replace(/(\d),(\d{3,})/g, '$1.$2');
  const found = [];
  const spans = [];
  const standard = /(\d{1,3})\s*[°º]\s*(\d{1,2})(?:\s*['′]\s*(\d{1,2}(?:\.\d+)?))?\s*(?:["″]|′′)?\s*(N|S|شمال|جنوب|ش|ج)\s*[,;،\s]+(\d{1,3})\s*[°º]\s*(\d{1,2})(?:\s*['′]\s*(\d{1,2}(?:\.\d+)?))?\s*(?:["″]|′′)?\s*(E|W|شرق|غرب)/giu;
  const decimalMinutes = /(N|S|شمال|جنوب|ش|ج)\s*(\d{1,3})\s+(\d{1,2}(?:\.\d+)?)\s+(E|W|شرق|غرب)\s*(\d{1,3})\s+(\d{1,2}(?:\.\d+)?)/giu;
  for (const match of text.matchAll(standard)) {
    const coord = makeCoordinate(dms(match[1], match[2], match[3], match[4]), dms(match[5], match[6], match[7], match[8]), 'manuel', options);
    if (coord) { found.push({ ...coord, format: 'dms', raw: match[0] }); spans.push({ start: match.index, end: match.index + match[0].length }); }
  }
  for (const match of text.matchAll(decimalMinutes)) {
    const coord = makeCoordinate(dms(match[2], match[3], 0, match[1]), dms(match[5], match[6], 0, match[4]), 'manuel', options);
    if (coord) { found.push({ ...coord, format: 'dms', raw: match[0] }); spans.push({ start: match.index, end: match.index + match[0].length }); }
  }
  const masked = [...text];
  spans.forEach((span) => { for (let i = span.start; i < span.end; i += 1) masked[i] = ' '; });
  const plain = masked.join('');
  const labeled = /lat(?:itude)?\s*[:=]?\s*(-?\d{1,3}(?:\.\d+)?)\s*[,; ]*\s*(?:lng|lon|longitude)\s*[:=]?\s*(-?\d{1,3}(?:\.\d+)?)/giu;
  const pairs = /(^|[^\d.])(-?\d{1,3}\.\d{3,})\s*[,;،\s]\s*(-?\d{1,3}\.\d{3,})(?![\d.])/g;
  for (const match of plain.matchAll(labeled)) {
    const coord = makeCoordinate(match[1], match[2], 'manuel', options);
    if (coord) { found.push({ ...coord, format: 'decimal', raw: match[0] }); spans.push({ start: match.index, end: match.index + match[0].length }); }
  }
  for (const match of plain.matchAll(pairs)) {
    const coord = makeCoordinate(match[2], match[3], 'manuel', options);
    if (coord) { found.push({ ...coord, format: 'decimal', raw: match[0].slice(match[1].length) }); spans.push({ start: match.index + match[1].length, end: match.index + match[0].length }); }
  }
  return { coords: found, spans };
}
