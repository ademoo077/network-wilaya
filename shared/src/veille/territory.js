import { arabiziToArabic, normalizeForMatch } from './normalize.js';

function variants(text) {
  return [...new Set([normalizeForMatch(text), normalizeForMatch(arabiziToArabic(text))])];
}

function hasPhrase(textTokens, phraseTokens) {
  if (!phraseTokens.length || phraseTokens.length > textTokens.length) return false;
  for (let start = 0; start <= textTokens.length - phraseTokens.length; start += 1) {
    let ok = true;
    for (let offset = 0; offset < phraseTokens.length; offset += 1) {
      if (textTokens[start + offset] !== phraseTokens[offset]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

export function resolveTerritory({ text = '', geo = null, aliases = [], communes = [], sourceCommuneId = null } = {}) {
  if (geo?.commune_id) {
    const commune = communes.find((item) => Number(item.id) === Number(geo.commune_id));
    if (commune) return { commune_id: commune.id, daira_id: commune.daira_id, source_geo: 'geolocalisation' };
  }
  const textTokens = variants(text).map((value) => value.split(' ').filter(Boolean));
  const candidates = [
    ...aliases.filter((alias) => alias.actif !== 0).map((alias) => ({
      label: alias.alias_norm || normalizeForMatch(alias.alias), commune_id: alias.commune_id,
      daira_id: alias.daira_id, source_geo: 'alias', rank: 0,
    })),
    ...communes.flatMap((commune) => [commune.name_fr, commune.name_ar].filter(Boolean).map((name) => ({
      label: normalizeForMatch(name), commune_id: commune.id, daira_id: commune.daira_id, source_geo: 'commune', rank: 1,
    }))),
  ].filter((candidate) => candidate.label)
    .sort((a, b) => a.rank - b.rank || b.label.split(' ').length - a.label.split(' ').length);
  for (const candidate of candidates) {
    const phrase = candidate.label.split(' ').filter(Boolean);
    if (textTokens.some((tokens) => hasPhrase(tokens, phrase))) {
      return { commune_id: candidate.commune_id, daira_id: candidate.daira_id, source_geo: candidate.source_geo };
    }
  }
  if (sourceCommuneId) {
    const commune = communes.find((item) => Number(item.id) === Number(sourceCommuneId));
    if (commune) return { commune_id: commune.id, daira_id: commune.daira_id, source_geo: 'source' };
  }
  return null;
}

export function geoFilterAllows(territory, mode = 'source_ou_lieu') {
  if (mode === 'aucun') return true;
  return Boolean(territory);
}
