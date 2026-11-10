import { makeCoordinate } from '@anm/shared';

export async function readBoundedHtml(response, limit = 512 * 1024) {
  if (!response.body?.getReader) return '';
  const reader = response.body.getReader(); const parts = []; let size = 0;
  try {
    while (size < limit) {
      const { value, done } = await reader.read();
      if (done) break;
      const part = value.subarray(0, limit - size); parts.push(Buffer.from(part)); size += part.byteLength;
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(parts).toString('utf8');
}
export function coordinatesFromHtml(html, options = {}) {
  const patterns = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /center=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/i,
    /\[null,null,(-?\d{1,2}\.\d{3,}),(-?\d{1,3}\.\d{3,})\]/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    const point = makeCoordinate(match[1], match[2], 'lien_court', options);
    if (!point) continue;
    return { ...point, confiance: point.lat >= 18 && point.lat <= 39 && point.lng >= -10 && point.lng <= 13 ? 'haute' : 'basse' };
  }
  return null;
}
export function placeFromHtml(html) {
  const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1];
  return title?.replace(/\s*[-–|]\s*Google Maps.*$/i, '').replace(/<[^>]*>/g, '').slice(0, 300) || undefined;
}
