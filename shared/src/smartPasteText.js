const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const NAMED_ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };

function decodeEntity(_match, token) {
  const lower = token.toLowerCase();
  if (NAMED_ENTITIES[lower] !== undefined) return NAMED_ENTITIES[lower];
  if (lower.startsWith('#x')) {
    const code = Number.parseInt(lower.slice(2), 16);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _match;
  }
  if (lower.startsWith('#')) {
    const code = Number.parseInt(lower.slice(1), 10);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _match;
  }
  return _match;
}

export function normalizeSmartText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/٫/g, '.')
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/&([a-z]+|#\d+|#x[0-9a-f]+);/gi, decodeEntity)
    .replace(/\r\n?/g, '\n');
}

const KNOWN_HOST = '(?:(?:www\\.|m\\.|l\\.|lm\\.)?facebook\\.com|fb\\.com|fb\\.watch|instagram\\.com|instagr\\.am|(?:vm\\.|vt\\.)?tiktok\\.com|youtube\\.com|youtu\\.be|x\\.com|twitter\\.com|t\\.co|t\\.me|wa\\.me|maps\\.google\\.[a-z.]+|google\\.[a-z.]+/maps|google\\.[a-z.]+/url|maps\\.app\\.goo\\.gl|goo\\.gl/maps|g\\.co/kgs|share\\.google|waze\\.com|maps\\.apple\\.com|openstreetmap\\.org|bing\\.com/maps|yandex\\.(?:ru|com)/maps|wego\\.here\\.com)';
const URL_RE = new RegExp(`(?:https?:\\/\\/[^\\s<>"']+|geo:-?\\d[^\\s<>"']*|(?:www\\.)?${KNOWN_HOST}(?:/[^\\s<>"']*)?)`, 'giu');
const TRAILING = /[)\]}>.,;:!?،؛»]+$/u;

export function extractUrls(text) {
  const found = [];
  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0].replace(TRAILING, '');
    if (!raw) continue;
    found.push({ raw, start: match.index, end: match.index + raw.length });
  }
  return found.filter((entry, index) => !found.slice(0, index).some((other) => other.start === entry.start && other.raw === entry.raw));
}

export function safeDecode(value) {
  try { return decodeURIComponent(String(value || '')); } catch { return String(value || ''); }
}

export function removeSpans(text, spans) {
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  let cursor = 0;
  let output = '';
  for (const span of ordered) {
    const start = Math.max(cursor, span.start);
    const end = Math.max(start, span.end);
    if (start > cursor) output += text.slice(cursor, start);
    output += ' '.repeat(Math.max(1, end - start));
    cursor = Math.max(cursor, end);
  }
  output += text.slice(cursor);
  return output.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
