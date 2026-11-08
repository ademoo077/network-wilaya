/**
 * Normalisation partagée (recherche, correspondance de référentiels, doublons).
 * NFKC, minuscules, accents latins, diacritiques arabes, tatweel,
 * unification alef/ya/ta-marbuta, espaces compactés.
 */
export function normalize(value) {
  if (value === null || value === undefined) return '';
  let text = String(value).normalize('NFKC').toLowerCase().normalize('NFD');
  text = text.replace(/[\u0300-\u036f]/g, '');
  text = text.replace(/[\u064b-\u065f\u0670]/g, '');
  text = text.replace(/\u0640/g, '');
  text = text.replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627');
  text = text.replace(/\u0649/g, '\u064a');
  text = text.replace(/\u0629/g, '\u0647');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

/** Construit la chaîne search_norm d'une anomalie (concaténation normalisée). */
export function buildSearchNorm(parts) {
  return normalize(parts.filter((p) => p !== null && p !== undefined && p !== '').join(' '));
}

/** Échappe les jokers LIKE pour une recherche littérale. */
export function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (m) => `\\${m}`);
}
