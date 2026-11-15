/**
 * Formateur central V8 (§ 4.5) : un seul endroit pour les nombres, les
 * pourcentages, les jours, les dates et la valeur indéfinie.
 *
 * Règles :
 * - FR : virgule décimale, espace fine insécable pour les milliers.
 * - AR : chiffres occidentaux (`ar-DZ-u-nu-latn`).
 * - `—` pour toute valeur indéfinie (null, undefined, NaN).
 * - Accords singulier/pluriel pour les jours.
 */

export const FORMAT_IDS = ['entier', 'decimal', 'pourcentage', 'jours', 'n_pct', 'date'];

const LOCALES = { fr: 'fr-FR', ar: 'ar-DZ-u-nu-latn' };

export function normalizeLang(lang) {
  return String(lang || '').toLowerCase().startsWith('ar') ? 'ar' : 'fr';
}

export function localeFor(lang) {
  return LOCALES[normalizeLang(lang)];
}

export function isBlank(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return Number.isNaN(value);
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

function toNumber(value) {
  if (isBlank(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Nombre formaté ; `—` si la valeur n'est pas un nombre fini. */
export function formatNumber(value, lang = 'fr', options = {}) {
  const n = toNumber(value);
  if (n === null) return '—';
  return new Intl.NumberFormat(localeFor(lang), {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
    useGrouping: options.useGrouping !== false,
  }).format(n);
}

export function pluralDays(value, lang = 'fr') {
  const n = toNumber(value);
  if (n === null) return '';
  const singular = Math.abs(n) === 1;
  if (normalizeLang(lang) === 'ar') return singular ? 'يوم' : 'أيام';
  return singular ? 'jour' : 'jours';
}

/** Date JJ/MM/AAAA, fuseau UTC pour éviter tout décalage de jour. */
export function formatDateShort(value, lang = 'fr') {
  if (isBlank(value)) return '—';
  const raw = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '—';
  const [y, m, d] = raw.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return '—';
  return new Intl.DateTimeFormat(localeFor(lang), { dateStyle: 'short', timeZone: 'UTC' }).format(date);
}

/**
 * Formate une valeur déjà calculée par le moteur.
 * `format` provient exclusivement du catalogue (liste blanche).
 * Pour `n_pct`, `value` peut être `{ n, pct }` ou `{ n, pct }` passé via `options`.
 */
export function formatValue(value, format = 'entier', lang = 'fr', options = {}) {
  if (format === 'n_pct') {
    const n = options.n ?? value?.n ?? null;
    const pct = options.pct ?? value?.pct ?? null;
    if (isBlank(n) && isBlank(pct)) return '—';
    return `${formatNumber(n, lang)} (${formatNumber(pct, lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %)`;
  }
  if (isBlank(value)) return '—';
  switch (format) {
    case 'entier':
      return formatNumber(value, lang, { maximumFractionDigits: 0 });
    case 'decimal':
      return formatNumber(value, lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    case 'pourcentage':
      return `${formatNumber(value, lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
    case 'jours':
      return `${formatNumber(value, lang, {
        minimumFractionDigits: Number.isInteger(toNumber(value)) ? 0 : 1,
        maximumFractionDigits: 1,
      })} ${pluralDays(value, lang)}`;
    case 'date':
      return formatDateShort(value, lang);
    default:
      return formatNumber(value, lang);
  }
}

/** Variation : relative en % pour les volumes, en points pour les taux. */
export function formatVariation(value, kind = 'percent', lang = 'fr') {
  const n = toNumber(value);
  if (n === null) return '—';
  if (kind === 'points') {
    return `${n > 0 ? '+' : ''}${formatNumber(n, lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts`;
  }
  return `${n > 0 ? '+' : ''}${formatNumber(n, lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

export const INDEFINI = '—';
