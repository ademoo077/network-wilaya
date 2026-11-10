import { decode, encode } from 'pluscodes';

export const ALGIERS_CENTER = { lat: 36.7538, lng: 3.0588 };
const alphabet = '0123456789bcdefghjkmnpqrstuvwxyz';
const olcAlphabet = '23456789CFGHJMPQRVWX';

function decodeCenter(code) {
  if (!decode(code)) return null;
  // Le paquet arrondit trop tôt à 6 décimales. Garder le centre exact de la cellule
  // (y compris les demi-microdegrés) jusqu'à l'arrondi final de makeCoordinate.
  const digits = code.replace(/[+0]/g, '');
  let lat = -90; let lng = -180; let latSize = 20; let lngSize = 20;
  for (let i = 0; i < Math.min(10, digits.length); i += 2) {
    if (i) { latSize /= 20; lngSize /= 20; }
    lat += olcAlphabet.indexOf(digits[i]) * latSize;
    lng += olcAlphabet.indexOf(digits[i + 1]) * lngSize;
  }
  for (const digit of digits.slice(10)) {
    const value = olcAlphabet.indexOf(digit); latSize /= 5; lngSize /= 4;
    lat += Math.floor(value / 4) * latSize; lng += value % 4 * lngSize;
  }
  return { latitude: Number((lat + latSize / 2).toFixed(12)), longitude: Number((lng + lngSize / 2).toFixed(12)), latitudeResolution: latSize };
}

export function recoverNearest(code, reference = ALGIERS_CENTER) {
  const missing = 8 - code.indexOf('+');
  if (!missing) return code;
  const ref = { latitude: reference.lat, longitude: reference.lng };
  const full = encode(ref).slice(0, missing) + code;
  const point = decodeCenter(full);
  if (!point) return null;
  const resolution = 20 ** (2 - missing / 2);
  const nearest = (value, target) => value + Math.round((target - value) / resolution) * resolution;
  return encode({ latitude: nearest(point.latitude, ref.latitude), longitude: nearest(point.longitude, ref.longitude) }, full.length - 1);
}

export function decodeGeohash(code) {
  if (!/^[0-9bcdefghjkmnpqrstuvwxyz]{1,12}$/i.test(code)) return null;
  const lat = [-90, 90]; const lng = [-180, 180];
  let longitude = true;
  for (const character of code.toLowerCase()) {
    const digit = alphabet.indexOf(character);
    for (let bit = 4; bit >= 0; bit -= 1) {
      const range = longitude ? lng : lat;
      const middle = (range[0] + range[1]) / 2;
      range[(digit >> bit) & 1 ? 0 : 1] = middle;
      longitude = !longitude;
    }
  }
  return { lat: (lat[0] + lat[1]) / 2, lng: (lng[0] + lng[1]) / 2,
    precision_m: Math.ceil((lat[1] - lat[0]) * 111320 / 2), format: 'geohash' };
}
export function extractPlusCodes(text) {
  const pattern = /(?<![A-Z0-9+])([23456789CFGHJMPQRVWX0]{0,8}\+[23456789CFGHJMPQRVWX]{2,7})(?![A-Z0-9+])/gi;
  const codes = [];
  for (const match of text.matchAll(pattern)) {
    const input = match[1].toUpperCase();
    if (input.indexOf('+') % 2 !== 0) continue;
    try {
      const short = input.indexOf('+') < 8;
      const full = recoverNearest(input);
      const area = full && decodeCenter(full);
      if (!area || Math.abs(area.latitude) > 90 || Math.abs(area.longitude) > 180) continue;
      // Éliminer le bruit binaire du calcul des cellules avant l'arrondi GPS à 6 décimales.
      codes.push({ lat: Number(area.latitude.toFixed(12)), lng: Number(area.longitude.toFixed(12)), code: full, court: short,
        precision_m: Math.ceil(area.latitudeResolution * 111320 / 2), format: 'olc',
        raw: match[0], start: match.index, end: match.index + match[0].length });
    } catch { /* Code non récupérable : aucune position plutôt qu'une approximation inventée. */ }
  }
  return codes;
}
