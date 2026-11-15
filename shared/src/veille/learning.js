import { normalizeForMatch, tokens } from './normalize.js';

const STOPWORDS = new Set(['dans', 'avec', 'pour', 'cette', 'mais', 'tout', 'tous', 'toute', 'plus', 'apres', 'avant',
  'depuis', 'entre', 'sans', 'sous', 'alger', 'algerie', 'wilaya', 'commune', 'photo', 'video', 'partage', 'merci',
  'allah', 'رحمه', 'الله', 'هذا', 'هذه', 'على', 'من', 'في', 'الى', 'عن', 'مع', 'كان', 'كانت', 'هناك']);

export function precisionFor(acceptes, rejetes) {
  const total = Number(acceptes) + Number(rejetes);
  return total >= 1 ? Number(acceptes) / total : null;
}

export function termsToRemove(lexicon, { minVus = 20, maxPrecision = 0.2 } = {}) {
  return lexicon.filter((term) => term.vus >= minVus)
    .map((term) => ({ ...term, precision: precisionFor(term.acceptes, term.rejetes) }))
    .filter((term) => term.precision !== null && term.precision < maxPrecision)
    .sort((a, b) => a.precision - b.precision || b.vus - a.vus);
}

export function termCandidates(texts, lexicon, { minOccurrences = 3, limit = 20 } = {}) {
  const covered = new Set();
  for (const term of lexicon) for (const token of String(term.terme_norm || '').split(' ')) covered.add(token);
  const counts = new Map();
  for (const text of texts) {
    const words = tokens(text).map((word) => normalizeForMatch(word)).filter((word) => word.length >= 3 && !STOPWORDS.has(word));
    for (let index = 0; index < words.length; index += 1) {
      for (const size of [1, 2]) {
        const phrase = words.slice(index, index + size);
        if (phrase.length !== size) continue;
        const value = phrase.join(' ');
        if (covered.has(value) || phrase.every((word) => covered.has(word))) continue;
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    }
  }
  return [...counts.entries()].filter(([, count]) => count >= minOccurrences)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit).map(([terme, occurrences]) => ({ terme, occurrences }));
}

export function aliasCandidates(texts, lexicon, { minOccurrences = 5, limit = 10 } = {}) {
  const known = new Set(lexicon.flatMap((term) => String(term.terme_norm || '').split(' ')));
  const counts = new Map();
  for (const text of texts) {
    for (const word of tokens(text).map((value) => normalizeForMatch(value))) {
      if (word.length < 4 || known.has(word) || STOPWORDS.has(word)) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, count]) => count >= minOccurrences)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit)
    .map(([alias, occurrences]) => ({ alias, occurrences }));
}
