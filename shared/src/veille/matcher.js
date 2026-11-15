import { arabiziToArabic, normalizeForMatch } from './normalize.js';

export const RISK_GROUPS = ['Risques naturels', 'Bâtiments et habitat'];

function keyOf(row) {
  if (row.type_id) return `t:${row.type_id}`;
  if (row.domaine_id) return `d:${row.domaine_id}`;
  if (row.groupe_id) return `g:${row.groupe_id}`;
  return null;
}

function termTokens(row) {
  return String(row.terme_norm || '').split(' ').filter(Boolean);
}

function matchesIn(tokens, term) {
  const out = [];
  if (!term.length || term.length > tokens.length) return out;
  for (let start = 0; start <= tokens.length - term.length; start += 1) {
    let ok = true;
    for (let offset = 0; offset < term.length; offset += 1) {
      if (tokens[start + offset] !== term[offset]) { ok = false; break; }
    }
    if (ok) out.push({ start, end: start + term.length });
  }
  return out;
}

/** Correspondances multi-mots, chevauchement résolu par le motif le plus long. */
export function findMatches(text, lexicon) {
  const variants = [...new Set([normalizeForMatch(text), normalizeForMatch(arabiziToArabic(text))])];
  const best = new Map();
  for (const variant of variants) {
    const tokens = variant.split(' ').filter(Boolean);
    if (!tokens.length) continue;
    const consumed = new Array(tokens.length).fill(false);
    const rows = [...lexicon].filter((row) => row.actif !== 0 && row.actif !== false)
      .map((row) => ({ row, term: termTokens(row) })).filter((item) => item.term.length)
      .sort((a, b) => b.term.length - a.term.length || String(a.row.terme_norm).localeCompare(String(b.row.terme_norm)));
    for (const { row, term } of rows) {
      for (const hit of matchesIn(tokens, term)) {
        if (consumed.slice(hit.start, hit.end).some(Boolean)) continue;
        for (let i = hit.start; i < hit.end; i += 1) consumed[i] = true;
        const current = best.get(row.id ?? `${row.terme_norm}|${row.langue}|${row.role}`) || { row, occurrences: 0 };
        current.occurrences += 1;
        best.set(row.id ?? `${row.terme_norm}|${row.langue}|${row.role}`, current);
      }
    }
  }
  return [...best.values()];
}

export function confidenceFor(score, distinctTerms, { suggestion = 4, pertinent = 2 } = {}) {
  if (score >= suggestion + 3 && distinctTerms >= 2) return 'haute';
  if (score >= suggestion) return 'moyenne';
  if (score >= pertinent) return 'basse';
  return null;
}

export function priorityFor({ urgent = false, viral = false, groupeNom = '', risqueGroupIds = [] } = {}) {
  const risky = risqueGroupIds.includes(groupeNom) || RISK_GROUPS.includes(groupeNom);
  if (urgent && (viral || risky)) return 'urgente';
  if (urgent || viral) return 'haute';
  return 'normale';
}

export function scoreMatches(matches, options = {}) {
  const suggestionSeuil = Number(options.seuils?.suggestion ?? 4);
  const pertinentSeuil = Number(options.seuils?.pertinent ?? 2);
  const groups = new Map();
  let exclusion = 0;
  const urgences = [];
  for (const { row, occurrences } of matches) {
    const weight = Number(row.poids || 0);
    const counted = weight * Math.min(occurrences, 2);
    if (row.role === 'exclusion') { exclusion += counted; continue; }
    if (row.role === 'urgence') { urgences.push({ ...row, occurrences }); continue; }
    const key = keyOf(row);
    if (!key) continue;
    const current = groups.get(key) || {
      key, groupe_id: row.groupe_id || null, domaine_id: row.domaine_id || null, type_id: row.type_id || null,
      score: 0, terms: new Map(),
    };
    current.score += counted;
    const previous = current.terms.get(row.id ?? row.terme_norm) || { ...row, occurrences: 0, poids_total: 0 };
    previous.occurrences += occurrences;
    previous.poids_total += counted;
    current.terms.set(row.id ?? row.terme_norm, previous);
    groups.set(key, current);
  }
  const suggestions = [...groups.values()].map((group) => {
    const distinct = group.terms.size;
    const bonus = distinct > 2 ? distinct - 2 : 0;
    const score = Math.max(0, group.score + bonus + exclusion);
    return {
      ...group, score,
      confidence: confidenceFor(score, distinct, { suggestion: suggestionSeuil, pertinent: pertinentSeuil }),
      raisons: [...group.terms.values()].sort((a, b) => b.poids_total - a.poids_total)
        .map((term) => ({ terme_id: term.id, terme: term.terme, occurrences: term.occurrences, poids: term.poids_total, role: term.role })),
    };
  }).filter((group) => group.score > 0 || group.confidence)
    .sort((a, b) => b.score - a.score).slice(0, 3);
  return {
    suggestions,
    matches: matches.map(({ row, occurrences }) => ({ ...row, occurrences })),
    urgences,
    exclusion,
    score: suggestions[0]?.score || 0,
    confidence: suggestions[0]?.confidence || null,
  };
}

export function analyserTexte(text, lexicon, options = {}) {
  const scored = scoreMatches(findMatches(text, lexicon), options);
  const groupName = options.groupName?.(scored.suggestions[0]) || '';
  const priorite = priorityFor({
    urgent: scored.urgences.length > 0,
    viral: Boolean(options.viral),
    groupeNom: groupName,
    risqueGroupIds: options.risqueGroupIds || [],
  });
  return { ...scored, priorite, urgent: scored.urgences.length > 0 };
}
