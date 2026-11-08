import { addDays, isDateString, todayAlgiers } from './dates.js';

const INSTAGRAM_EPOCH = 1314220021721n;
const INSTAGRAM_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function guardedDate(ms, options = {}) {
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  const value = todayAlgiers(date);
  const today = options.today || todayAlgiers();
  if (value < '2016-01-01' || value > addDays(today, 1)) return null;
  return value;
}

export function estimateTikTokDate(id, options = {}) {
  if (!/^\d{18,19}$/.test(String(id || ''))) return null;
  try {
    const seconds = Number(BigInt(id) >> 32n);
    return guardedDate(seconds * 1000, options);
  } catch {
    return null;
  }
}

export function decodeInstagramMediaId(code) {
  const value = String(code || '').slice(0, 11);
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  let mediaId = 0n;
  for (const char of value) mediaId = mediaId * 64n + BigInt(INSTAGRAM_ALPHABET.indexOf(char));
  return mediaId;
}

export function estimateInstagramDate(code, options = {}) {
  const mediaId = decodeInstagramMediaId(code);
  if (mediaId === null) return null;
  const milliseconds = Number((mediaId >> 23n) + INSTAGRAM_EPOCH);
  return guardedDate(milliseconds, options);
}

export function estimateSocialDate(platform, url, options = {}) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (platform === 'tiktok') {
    const id = parsed.pathname.match(/\/video\/(\d{18,19})(?:\/|$)/)?.[1];
    const date = estimateTikTokDate(id, options);
    return date ? { date, estimee: true, source: 'url_tiktok' } : null;
  }
  if (platform === 'instagram') {
    const code = parsed.pathname.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)?.[1];
    const date = estimateInstagramDate(code, options);
    return date ? { date, estimee: true, source: 'url_instagram' } : null;
  }
  return null;
}

export function explicitDates(text) {
  const dates = [];
  for (const match of text.matchAll(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/g)) {
    const date = `${match[3]}-${match[2]}-${match[1]}`;
    if (isDateString(date)) dates.push({ date, estimee: false, source: 'texte' });
  }
  return dates;
}

export { INSTAGRAM_ALPHABET, INSTAGRAM_EPOCH };
