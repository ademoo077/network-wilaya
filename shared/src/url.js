const TRACKING = new Set([
  'fbclid', 'igshid', 'igsh', 'mibextid', 'si', 'feature', 'ref', 'ref_src', 's', 't',
]);

const PLATFORM_HOSTS = [
  ['facebook', ['facebook.com', 'fb.com', 'fb.watch']],
  ['instagram', ['instagram.com', 'instagr.am']],
  ['tiktok', ['tiktok.com']],
  ['youtube', ['youtube.com', 'youtu.be']],
  ['x', ['x.com', 'twitter.com', 't.co']],
  ['whatsapp', ['wa.me', 'whatsapp.com']],
  ['telegram', ['t.me', 'telegram.me']],
];

function hostMatches(host, suffix) {
  return host === suffix || host.endsWith(`.${suffix}`);
}

export function detecterPlateforme(host) {
  const h = String(host || '').toLowerCase();
  for (const [name, suffixes] of PLATFORM_HOSTS) {
    if (suffixes.some((s) => hostMatches(h, s))) return name;
  }
  return 'autre';
}

/**
 * Normalise une URL de publication : http(s) seulement, hôte sans www/m/mobile,
 * fragment supprimé, paramètres de suivi retirés, paramètres triés, slash final retiré.
 * @returns {{ok:true,url:string,plateforme:string}|{ok:false,error:string}}
 */
export function normaliserUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: 'URL_REQUISE' };
  }
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, error: 'URL_INVALIDE' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'SCHEMA_INTERDIT' };
  }
  let host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  host = host.replace(/^(www|m|mobile)\./, '');
  const labels = host.split('.');
  const labelsOk = labels.length > 0 && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
  if (!host || !labelsOk) {
    return { ok: false, error: 'HOTE_INVALIDE' };
  }
  const params = [...parsed.searchParams.entries()]
    .filter(([key]) => {
      const k = key.toLowerCase();
      return !TRACKING.has(k) && !k.startsWith('utm_');
    })
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1));
  let path = parsed.pathname.replace(/\/+$/, '');
  if (path === '') path = '/';
  const query = new URLSearchParams(params).toString();
  const url = `${parsed.protocol}//${host}${path}${query ? `?${query}` : ''}`;
  return { ok: true, url, plateforme: detecterPlateforme(host) };
}

/** Vérifie qu'une URL est sûre pour un lien cliquable (http/https). */
export function isSafeHttpUrl(raw) {
  try {
    const u = new URL(String(raw));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
