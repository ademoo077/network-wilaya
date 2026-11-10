import { normalize } from './normalize.js';

const stopWords = new Set('de du des le la les un une et en au aux a d l dans sur pour avec في من علي الي و عن وجود'.split(' '));
const generic = new Set(['عام', 'general', 'autre', 'autres', 'غير محدد', 'غياب', 'نقص']);

function tokens(value) {
  return normalize(value).replace(/https?:\/\/\S+|www\.\S+/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/)
    .filter(Boolean).map((word) => /^[\u0600-\u06ff]+$/.test(word)
      ? word.replace(/^[وبف]?ال(?=.{3})/, '').replace(/^لل(?=.{3})/, '')
      : word.replace(/^([a-z]{3,})s$/, '$1'));
}
function matchName(label, textTokens) {
  if (!label || generic.has(normalize(label))) return null;
  const words = tokens(label); const meaningful = [...new Set(words.filter((word) => !stopWords.has(word)))];
  if (!meaningful.length) return null;
  const matches = (word, token) => word === token || /^[وف][\u0600-\u06ff]{3,}$/.test(token) && token.slice(1) === word;
  const phrase = textTokens.some((_token, index) => words.every((word, offset) => matches(word, textTokens[index + offset] || '')));
  const found = meaningful.filter((word) => textTokens.some((token) => matches(word, token)));
  const ratio = found.length / meaningful.length;
  if (!phrase && (found.length < 2 || ratio < 0.75)) return null;
  return { matched_name: label, match: phrase ? 'phrase' : 'words', score: (phrase ? 100 : Math.round(ratio * 60)) + Math.min(words.length, 12) };
}

/** Comparaison locale des libellés uniquement ; aucun choix n'est appliqué par ce moteur. */
export function suggestAnomalyTypes(text, domains, { limit = 5, domaineId } = {}) {
  const textTokens = tokens(String(text || '').slice(0, 20000));
  if (!textTokens.length) return [];
  const choices = [];
  for (const domain of domains || []) {
    if (Number(domain.actif) === 0) continue;
    const categoryMatch = [domain.name_fr, domain.name_ar].some((name) => matchName(name, textTokens));
    for (const type of domain.types || []) {
      if (Number(type.actif) === 0) continue;
      const evidence = [type.name_fr, type.name_ar].map((name) => matchName(name, textTokens)).filter(Boolean).sort((a, b) => b.score - a.score)[0];
      if (evidence) choices.push({ type_id: type.id, domaine_id: domain.id, ...evidence,
        score: evidence.score + (categoryMatch ? 25 : 0) + (String(domain.id) === String(domaineId) ? 5 : 0) });
    }
  }
  return choices.sort((a, b) => b.score - a.score || a.domaine_id - b.domaine_id || a.type_id - b.type_id).slice(0, Math.max(1, Math.min(limit, 10)));
}
