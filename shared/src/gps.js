import { coordinateFromMapUrl, extractCoordinatesFromText } from './smartPasteCoords.js';

const SHORT_LINK_RE = /(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)/i;

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function parsePair(latRaw, lngRaw) {
  const lat = Number(String(latRaw).replace(',', '.'));
  const lng = Number(String(lngRaw).replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function fromText(text) {
  let s = text.trim();
  s = s.replace(/[°º]/g, ' ');
  // Retire les lettres cardinales accolées aux nombres : « 36.7538°N 3.0588°E ».
  s = s.replace(/([0-9])\s*[NSEW]\b/gi, '$1');
  if (s.includes(';')) {
    const parts = s.split(';').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return parsePair(parts[0], parts[1]);
  }
  // virgules décimales : "36,7538, 3,0588" ou "36,7538 3,0588" ou "36,7538 ; 3,0588"
  s = s.replace(/(\d),(\d)/g, '$1.$2');
  const m = s.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (m) return parsePair(m[1], m[2]);
  return null;
}

function fromLink(text) {
  const patterns = [
    /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /[!?]3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /[?&](?:q|ll|sll|center)=(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /[?&]mlat=(-?\d{1,3}(?:\.\d+)?).*?[?&]mlon=(-?\d{1,3}(?:\.\d+)?)/,
    /[?&]mlon=(-?\d{1,3}(?:\.\d+)?).*?[?&]mlat=(-?\d{1,3}(?:\.\d+)?)/,
    /#map=\d+(?:\.\d+)?\/(-?\d{1,3}(?:\.\d+)?)\/(-?\d{1,3}(?:\.\d+)?)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const isMlonFirst = re.source.includes('mlon=') && re.source.indexOf('mlon') < re.source.indexOf('mlat');
      if (isMlonFirst) return parsePair(m[2], m[1]);
      return parsePair(m[1], m[2]);
    }
  }
  return null;
}

function inBbox(lat, lng, bbox) {
  if (!bbox) return true;
  const [latMin, lngMin, latMax, lngMax] = bbox.split(',').map(Number);
  if ([latMin, lngMin, latMax, lngMax].some((n) => !Number.isFinite(n))) return true;
  return lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax;
}

/**
 * Parseur GPS partagé (§ 4.6).
 * @param {string} input
 * @param {{bbox?:string}} options
 */
export function parseGps(input, options = {}) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: true, lat: null, lng: null };
  if (SHORT_LINK_RE.test(raw) && !raw.includes('@')) {
    return { ok: false, error: 'LIEN_COURT_NON_RESOLU' };
  }
  let found = (raw.includes('http') || raw.includes('maps') || raw.includes('#map') || raw.includes('mlat'))
    ? fromLink(raw)
    : fromText(raw);
  if (!found && (/^(?:https?:|geo:)/i.test(raw) || /(?:waze|apple|openstreetmap)/i.test(raw))) {
    const parsed = coordinateFromMapUrl(raw, options);
    if (parsed) found = { lat: parsed.lat, lng: parsed.lng };
  }
  if (!found) {
    const parsed = extractCoordinatesFromText(raw, options).coords[0];
    if (parsed) found = { lat: parsed.lat, lng: parsed.lng };
  }
  if (!found) return { ok: false, error: 'GPS_INVALIDE' };
  let { lat, lng } = found;
  let swapped = false;
  // En Algérie la latitude (~36°) est nettement supérieure à la longitude (~3°).
  // Une paire dont la première valeur est la plus petite et la seconde ≥ 30° est
  // considérée comme inversée ; une valeur hors plage n'est jamais « réparée ».
  if (
    Math.abs(lat) <= 90 && Math.abs(lng) <= 90
    && Math.abs(lat) < Math.abs(lng) && Math.abs(lng) >= 30
  ) {
    [lat, lng] = [lng, lat];
    swapped = true;
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, error: 'GPS_HORS_PLAGE' };
  lat = round6(lat);
  lng = round6(lng);
  const warning = inBbox(lat, lng, options.bbox) ? null : 'GPS_HORS_ZONE';
  return { ok: true, lat, lng, swapped, warning };
}

/** Formate des coordonnées pour affichage / copie. */
export function formatGps(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}
