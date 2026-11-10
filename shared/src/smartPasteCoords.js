import { decodeGeohash, extractPlusCodes } from './locationCodes.js';
import { isMapUrl } from './linkPolicy.js';
import { safeDecode } from './smartPasteText.js';
import { roundCoordinate } from './coordinates.js';

const DIRECTIONS = { n: 1, north: 1, 'ش': 1, 'شمال': 1, s: -1, south: -1, 'ج': -1, 'جنوب': -1,
  e: 1, east: 1, 'شرق': 1, w: -1, west: -1, 'غرب': -1 };
function decimalPlaces(raw) {
  const part = String(raw).replace(',', '.').split('.')[1];
  return part ? part.replace(/\D.*$/, '').length : 0;
}
export function inBbox(lat, lng, bbox) {
  if (!bbox) return true;
  const values = String(bbox).split(',').map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return true;
  return lat >= values[0] && lat <= values[2] && lng >= values[1] && lng <= values[3];
}
export function makeCoordinate(latRaw, lngRaw, source = 'manuel', options = {}) {
  let lat = Number(String(latRaw).replace(',', '.')); let lng = Number(String(lngRaw).replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  let inversionProposee = false;
  if (Math.abs(lat) > 90 && Math.abs(lat) <= 180 && Math.abs(lng) <= 90) { [lat, lng] = [lng, lat]; inversionProposee = true; }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  lat = roundCoordinate(lat); lng = roundCoordinate(lng);
  const decimals = Math.min(decimalPlaces(latRaw), decimalPlaces(lngRaw));
  const precision = decimals ? Math.max(1, Math.round(111320 / (10 ** decimals))) : null;
  return { lat, lng, source, confiance: inversionProposee ? 'moyenne' : 'haute',
    ...(precision ? { precision_m: precision } : {}), ...(inversionProposee ? { inversionProposee: true } : {}),
    ...(!inBbox(lat, lng, options.bbox) ? { hors_zone: true } : {}) };
}

function pair(value) {
  const match = safeDecode(value).replace(/\+/g, ' ').match(/(?:^|[^\d.])(-?\d{1,3}(?:\.\d+)?)\s*[,;~، ]\s*(-?\d{1,3}(?:\.\d+)?)(?![\d.])/);
  return match ? [match[1], match[2]] : null;
}
export function coordinateFromMapUrl(raw, options = {}) {
  if (/^geo:/i.test(raw)) {
    const values = pair(raw.slice(4));
    return values ? makeCoordinate(...values, 'lien_carte', options) : null;
  }
  let url;
  try { url = new URL(/^https?:/i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  if (!isMapUrl(url)) return null;
  const text = safeDecode(url.href);
  const pin = text.match(/!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/);
  const osm = url.searchParams.has('mlat') && url.searchParams.has('mlon') ? [url.searchParams.get('mlat'), url.searchParams.get('mlon')] : null;
  const hash = url.hash.match(/#map=\d+(?:\.\d+)?\/(-?\d{1,3}(?:\.\d+)?)\/(-?\d{1,3}(?:\.\d+)?)/);
  const at = text.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)(?:,|\/|$)/);
  const itinerary = url.pathname.includes('/dir/');
  const destination = itinerary ? safeDecode(url.pathname).split('/').reverse().map((part) => pair(part)).find(Boolean) : null;
  let ll = pair(url.searchParams.get('ll'));
  if (url.hostname.includes('yandex.') && ll) ll = ll.reverse();
  const pinPair = [pin?.slice(1), pair(url.searchParams.get('q')), pair(url.searchParams.get('query')), ll,
    pair(url.searchParams.get('center')), pair(url.searchParams.get('cp')), pair(url.searchParams.get('map')),
    pair(url.searchParams.get('cbll')), pair(url.searchParams.get('destination')), pair(url.searchParams.get('daddr')), destination,
    osm, hash?.slice(1)].find(Boolean);
  const values = pinPair || at?.slice(1) || pair(url.pathname);
  if (values) {
    const result = makeCoordinate(...values, 'lien_carte', options);
    return result ? { ...result, rang: pinPair ? 3 : 2, ...(itinerary ? { avertissement: 'DESTINATION' } : {}) } : null;
  }
  const geohash = url.hostname.endsWith('waze.com') && url.pathname.match(/\/ul\/h([0-9bcdefghjkmnpqrstuvwxyz]+)(?:\/|$)/i)?.[1];
  const coded = geohash ? decodeGeohash(geohash) : extractPlusCodes(safeDecode(url.searchParams.get('q') || url.pathname))[0];
  if (!coded) return null;
  return { ...makeCoordinate(coded.lat, coded.lng, 'lien_carte', options), format: coded.format, precision_m: coded.precision_m, rang: 3 };
}

function dms(degrees, minutes, seconds, direction) {
  const sign = DIRECTIONS[String(direction).toLowerCase()];
  if (!sign || Number(minutes) >= 60 || Number(seconds) >= 60) return NaN;
  return sign * (Number(degrees) + Number(minutes || 0) / 60 + Number(seconds || 0) / 3600);
}
export function extractCoordinatesFromText(value, options = {}) {
  const text = String(value || '').replace(/(\d),(\d{3,})/g, '$1.$2');
  const found = []; const spans = [];
  const add = (match, lat, lng, format, source = 'manuel', extra = {}) => {
    const coord = makeCoordinate(lat, lng, source, options);
    if (coord) found.push({ ...coord, format, raw: match[0], ...extra });
    spans.push({ start: match.index, end: match.index + match[0].length });
  };
  for (const code of extractPlusCodes(text)) add({ 0: code.raw, index: code.start }, code.lat, code.lng, 'olc', 'olc', { precision_m: code.precision_m, code: code.code, court: code.court });
  const standard = /(\d{1,3})\s*[°º]\s*(\d{1,2})(?:\s*['′]\s*(\d{1,2}(?:\.\d+)?))?\s*(?:["″]|′′)?\s*(N|S|شمال|جنوب|ش|ج)\s*[,;،\s]+(\d{1,3})\s*[°º]\s*(\d{1,2})(?:\s*['′]\s*(\d{1,2}(?:\.\d+)?))?\s*(?:["″]|′′)?\s*(E|W|شرق|غرب)/giu;
  const minutes = /(N|S|شمال|جنوب|ش|ج)\s*(\d{1,3})\s+(\d{1,2}(?:\.\d+)?)\s+(E|W|شرق|غرب)\s*(\d{1,3})\s+(\d{1,2}(?:\.\d+)?)/giu;
  const prefix = /(N|S|شمال|جنوب|ش|ج)\s*(\d{1,3}(?:\.\d+)?)\s*[,;،\s]+(E|W|شرق|غرب)\s*(\d{1,3}(?:\.\d+)?)/giu;
  const suffix = /(\d{1,3}(?:\.\d+)?)\s*[°º]?\s*(N|S|شمال|جنوب|ش|ج)\s*[,;،\s]+(\d{1,3}(?:\.\d+)?)\s*[°º]?\s*(E|W|شرق|غرب)/giu;
  for (const m of text.matchAll(standard)) add(m, dms(m[1], m[2], m[3], m[4]), dms(m[5], m[6], m[7], m[8]), 'dms');
  for (const m of text.matchAll(minutes)) add(m, dms(m[2], m[3], 0, m[1]), dms(m[5], m[6], 0, m[4]), 'dms');
  const masked = () => { const chars = text.split(''); spans.forEach(({ start, end }) => { for (let i = start; i < end; i += 1) chars[i] = ' '; }); return chars.join(''); };
  for (const m of masked().matchAll(prefix)) add(m, dms(m[2], 0, 0, m[1]), dms(m[4], 0, 0, m[3]), 'decimal');
  for (const m of masked().matchAll(suffix)) add(m, dms(m[1], 0, 0, m[2]), dms(m[3], 0, 0, m[4]), 'decimal');
  const labeled = /lat(?:itude)?\s*[:=]?\s*(-?\d{1,3}(?:\.\d+)?)\s*[,; ]*\s*(?:lng|lon|longitude)\s*[:=]?\s*(-?\d{1,3}(?:\.\d+)?)/giu;
  const pairs = /(?<![\d.])(-?\d{1,3}\.\d+)\s*[,;،\s]\s*(-?\d{1,3}\.\d+)(?![\d.])/g;
  for (const m of masked().matchAll(labeled)) add(m, m[1], m[2], 'decimal');
  for (const m of masked().matchAll(pairs)) add(m, m[1], m[2], 'decimal');
  return { coords: found, spans };
}

export function gpsStorageSource(source) { return source === 'olc' ? 'manuel' : source; }
