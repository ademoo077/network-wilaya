import { detecterPlateforme, normaliserUrl } from './url.js';
import { coordinateFromMapUrl } from './smartPasteCoords.js';

const MAP_HOSTS = ['google.com', 'google.dz', 'maps.app.goo.gl', 'goo.gl', 'waze.com', 'maps.apple.com', 'openstreetmap.org'];
const SHORT_MAP = /^(?:maps\.app\.goo\.gl|goo\.gl)$/i;

function hostMatches(host, suffix) {
  return host === suffix || host.endsWith(`.${suffix}`);
}

function withScheme(raw) {
  if (/^(?:https?:|geo:)/i.test(raw)) return raw;
  return `https://${raw}`;
}

export function unwrapUrl(raw) {
  let current = withScheme(raw);
  for (let depth = 0; depth < 3; depth += 1) {
    let url;
    try { url = new URL(current); } catch { return current; }
    const host = url.hostname.toLowerCase();
    let nested = null;
    if (hostMatches(host, 'l.facebook.com') || hostMatches(host, 'lm.facebook.com')) nested = url.searchParams.get('u');
    else if (hostMatches(host, 'google.com') || /^google\.[a-z.]+$/.test(host)) {
      if (url.pathname === '/url') nested = url.searchParams.get('q') || url.searchParams.get('url');
    } else if (hostMatches(host, 'l.instagram.com')) nested = url.searchParams.get('u');
    else if (hostMatches(host, 'out.tiktok.com')) nested = url.searchParams.get('url') || url.searchParams.get('u') || url.searchParams.get('target');
    if (!nested || !/^https?:\/\//i.test(nested)) return current;
    current = nested;
  }
  return current;
}

function contentType(platform, url) {
  const path = url.pathname.toLowerCase();
  if (platform === 'facebook') {
    if (/\/(?:reel|reels)\//.test(path)) return 'reel';
    if (/\/(?:watch|videos?)\//.test(path) || url.pathname === '/watch/') return 'video';
    if (/\/(?:stories?|story)\//.test(path)) return 'story';
    if (/\/(?:photos?|photo)\//.test(path)) return 'photo';
    if (/\/(?:posts?|share)\//.test(path)) return 'post';
  }
  if (platform === 'instagram') {
    if (/\/reel\//.test(path)) return 'reel';
    if (/\/stories\//.test(path)) return 'story';
    if (/\/tv\//.test(path)) return 'video';
    if (/\/p\//.test(path)) return 'post';
  }
  if (platform === 'tiktok') {
    if (/\/video\//.test(path)) return 'video';
    if (/\/photo\//.test(path)) return 'photo';
  }
  if (platform === 'youtube') {
    if (/\/shorts\//.test(path)) return 'short';
    if (/\/(?:watch|live)\b/.test(path) || url.searchParams.has('v')) return 'video';
  }
  if (platform === 'x' && /\/status\//.test(path)) return 'post';
  return 'autre';
}

export function classifyUrl(raw, options = {}) {
  const unwrapped = unwrapUrl(raw);
  if (/^geo:/i.test(unwrapped)) {
    return { brut: raw, type: 'carte', plateforme: null, contenuType: null, normalise: unwrapped, coords: coordinateFromMapUrl(unwrapped, options) };
  }
  let url;
  try { url = new URL(withScheme(unwrapped)); } catch {
    return { brut: raw, type: 'autre', plateforme: 'autre', contenuType: 'autre', normalise: unwrapped };
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
  const plateforme = detecterPlateforme(host);
  if (plateforme !== 'autre') {
    const normalized = normaliserUrl(url.href);
    return {
      brut: raw, type: 'social', plateforme, contenuType: contentType(plateforme, url),
      normalise: normalized.ok ? normalized.url : url.href,
    };
  }
  if (MAP_HOSTS.some((candidate) => hostMatches(host, candidate)) || host.includes('google.') && url.pathname.startsWith('/maps')) {
    return {
      brut: raw, type: 'carte', plateforme: null, contenuType: null, normalise: url.href,
      ...(SHORT_MAP.test(host) || host === 'maps.app.goo.gl' ? { a_resoudre: true } : {}),
      coords: coordinateFromMapUrl(url.href, options),
    };
  }
  return { brut: raw, type: 'autre', plateforme: 'autre', contenuType: 'autre', normalise: url.href };
}
