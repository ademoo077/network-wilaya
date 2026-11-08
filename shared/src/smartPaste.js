import { haversineMeters } from './geo.js';
import { explicitDates, estimateSocialDate } from './smartPasteDates.js';
import { extractCoordinatesFromText } from './smartPasteCoords.js';
import { extractUrls, normalizeSmartText, removeSpans } from './smartPasteText.js';
import { classifyUrl } from './smartPasteUrls.js';

function uniqueCoordinates(coords) {
  const out = [];
  for (const coord of coords) {
    if (!out.some((existing) => haversineMeters(existing, coord) <= 1)) out.push(coord);
  }
  return out;
}

function uniqueDates(dates) {
  const seen = new Set();
  return dates.filter((entry) => {
    const key = `${entry.date}|${entry.estimee}|${entry.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseSmartPaste(value, options = {}) {
  const text = normalizeSmartText(value);
  const extracted = extractUrls(text);
  const urls = extracted.map((entry) => classifyUrl(entry.raw, options));
  const mapCoords = urls.filter((url) => url.coords).map((url) => ({ ...url.coords, url: url.normalise }));
  const withoutUrls = removeSpans(text, extracted);
  const textCoordinates = extractCoordinatesFromText(withoutUrls, options);
  const dates = [
    ...urls.filter((url) => url.type === 'social').map((url) => estimateSocialDate(url.plateforme, url.normalise, options)).filter(Boolean),
    ...explicitDates(withoutUrls),
  ];
  const texteRestant = removeSpans(withoutUrls, textCoordinates.spans);
  return {
    urls,
    coords: uniqueCoordinates([...mapCoords, ...textCoordinates.coords]),
    dates: uniqueDates(dates),
    texteRestant,
  };
}

export { normalizeSmartText } from './smartPasteText.js';
export { estimateTikTokDate, estimateInstagramDate, decodeInstagramMediaId } from './smartPasteDates.js';
