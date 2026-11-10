import { detecterPlateforme, normaliserUrl } from './url.js';
import { coordinateFromMapUrl } from './smartPasteCoords.js';
import { hostMatches, isGoogleHost, isMapUrl, isShortMapUrl, isShortSocialUrl } from './linkPolicy.js';
import { safeDecode } from './smartPasteText.js';

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
    if (hostMatches(host, 'l.facebook.com') || hostMatches(host, 'lm.facebook.com') || hostMatches(host, 'facebook.com') && url.pathname.startsWith('/sharer/')) nested = url.searchParams.get('u');
    else if (isGoogleHost(host)) {
      if (host.startsWith('consent.')) nested = url.searchParams.get('continue');
      else if (url.pathname === '/url') nested = url.searchParams.get('q') || url.searchParams.get('url');
    } else if (hostMatches(host, 'l.instagram.com')) nested = url.searchParams.get('u');
    else if (hostMatches(host, 'out.tiktok.com')) nested = url.searchParams.get('url') || url.searchParams.get('u') || url.searchParams.get('target');
    if (!nested || !/^https?:\/\//i.test(nested)) return current;
    current = nested;
  }
  return current;
}

function contentType(platform, url) {
  const path = url.pathname.toLowerCase();
  if (/\/live(?:\/|$)/.test(path)) return 'direct';
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
      ...(isShortSocialUrl(url) ? { a_resoudre: true } : {}),
    };
  }
  if (isMapUrl(url)) {
    const place = url.pathname.match(/\/place\/([^/]+)/)?.[1];
    return {
      brut: raw, type: 'carte', plateforme: null, contenuType: null, normalise: url.href,
      ...(isShortMapUrl(url) ? { a_resoudre: true } : {}),
      ...(place ? { lieu: safeDecode(place.replace(/\+/g, ' ')).slice(0, 300) } : {}),
      coords: coordinateFromMapUrl(url.href, options),
    };
  }
  return { brut: raw, type: 'autre', plateforme: 'autre', contenuType: 'autre', normalise: url.href };
}
