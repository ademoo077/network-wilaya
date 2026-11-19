import { normalize, normaliserUrl } from '@anm/shared';

/**
 * Moteur d'import intelligent pour anomalies.
 * Améliore la détection des doublons, la normalisation des données et le scoring.
 */

const norm = (value) => normalize(String(value ?? '').trim().toLowerCase());
const similarity = (a, b) => {
  const A = norm(a); const B = norm(b);
  if (A === B) return 1;
  const sa = A.split(/\s+/); const sb = B.split(/\s+/);
  let common = 0;
  for (const t of sa) if (sb.includes(t)) common += 1;
  return common / Math.max(sa.length, sb.length);
};

const pick = (candidates, target, threshold = 0.75) => {
  let best = null; let score = 0;
  for (const c of candidates) {
    const s = Math.max(similarity(c.name, target), similarity(c.ar, target));
    if (s > score && s >= threshold) { score = s; best = c; }
  }
  return best;
};

export function buildIntelligentIndex(db) {
  const domaines = db.prepare('SELECT id, name_fr, name_ar FROM domaines').all()
    .map((d) => ({ id: d.id, name: d.name_fr || d.name_ar, ar: d.name_ar, fr: d.name_fr }));
  const types = db.prepare('SELECT id, domaine_id, name_ar, name_fr FROM types_anomalie').all()
    .map((t) => ({ id: t.id, domaine_id: t.domaine_id, name: t.name_fr || t.name_ar, ar: t.name_ar, fr: t.name_fr }));
  const dairas = db.prepare('SELECT id, name_fr, name_ar FROM dairas').all()
    .map((d) => ({ id: d.id, name: d.name_fr || d.name_ar, ar: d.name_ar, fr: d.name_fr }));
  const communes = db.prepare('SELECT id, daira_id, name_fr, name_ar FROM communes').all()
    .map((c) => ({ id: c.id, daira_id: c.daira_id, name: c.name_fr || c.name_ar, ar: c.name_ar, fr: c.name_fr }));
  return { domaines, types, dairas, communes };
}

export function matchTerritory(intelligentIndex, communeName, dairaName) {
  const { dairas, communes } = intelligentIndex;
  let daira = pick(dairas, dairaName || communeName || '');
  let commune = pick(communes, communeName || '');
  if (!daira && commune) daira = dairas.find((d) => d.id === commune.daira_id);
  return { daira, commune };
}

export function matchType(intelligentIndex, categoryName, typeName) {
  const { domaines, types } = intelligentIndex;
  const domain = pick(domaines, categoryName || '');
  const type = pick(types, typeName || '');
  return { domain, type, fallback: !domain || !type };
}

export function extractLinks(row) {
  const links = [];
  for (const [key, value] of Object.entries(row)) {
    if (/lien|url|link|http/i.test(key)) {
      const u = normaliserUrl(String(value || '').trim());
      if (u.ok) links.push({ key, value: u.url });
    }
  }
  return links;
}

export function extractDates(row) {
  const dates = {};
  for (const [key, value] of Object.entries(row)) {
    if (/date|jour|temps|quand/i.test(key)) {
      const d = String(value || '').trim();
      dates[key] = /^\d{2}\/\d{2}\/\d{4}$/.test(d)
        ? d.split('/').reverse().join('-')
        : d;
    }
  }
  return dates;
}

export function extractStatus(row) {
  const statusMap = {
    traite: 'traite', traitee: 'traite', traité: 'traite', 'en cours': 'en_cours', encours: 'en_cours',
    'non traite': 'non_traite', 'non traitée': 'non_traite', nouveau: 'non_traite',
    'en attente': 'non_traite', valide: 'traite', confirme: 'traite',
  };
  for (const [key, value] of Object.entries(row)) {
    if (/statut|status|etat|état|traitement|resultat|résultat/i.test(key)) {
      const v = norm(value);
      if (statusMap[v]) return statusMap[v];
    }
  }
  return 'non_traite';
}

export function analyzeRow(row, intelligentIndex, _refs) {
  const links = extractLinks(row);
  const dates = extractDates(row);
  const status = extractStatus(row);
  const link = links[0]?.value || null;
  const date = dates.date_signalement || dates.date || dates.date_publication || new Date().toISOString().slice(0, 10);
  const communeName = row.commune || row.Commune || '';
  const dairaName = row.daira || row.Daira || row.daïra || row.Daïra || '';
  const { daira, commune } = matchTerritory(intelligentIndex, communeName, dairaName);
  const category = row.categorie || row.Categorie || row.domaine || row.Domaine || '';
  const typeName = row.type || row.Type || row.type_anomalie || '';
  const { domain, type } = matchType(intelligentIndex, category, typeName);

  return {
    lien_url: link,
    date_signalement: date,
    daira_id: daira?.id || null,
    commune_id: commune?.id || null,
    domaine_id: domain?.id || null,
    type_id: type?.id || null,
    statut: status,
    raw: row,
    flags: {
      hasLink: Boolean(link),
      hasDaira: Boolean(daira),
      hasCommune: Boolean(commune),
      hasDomain: Boolean(domain),
      hasType: Boolean(type),
      isComplete: Boolean(link && daira && commune && domain && type),
    },
  };
}

export function scoreRow(analysis) {
  let score = 0;
  if (analysis.flags.hasLink) score += 25;
  if (analysis.flags.hasDaira) score += 20;
  if (analysis.flags.hasCommune) score += 20;
  if (analysis.flags.hasDomain) score += 20;
  if (analysis.flags.hasType) score += 15;
  return score;
}

export function filterRows(rows, intelligentIndex, refs) {
  const results = rows.map((row, index) => {
    const analysis = analyzeRow(row, intelligentIndex, refs);
    analysis.rowNumber = index + 1;
    analysis.score = scoreRow(analysis);
    return analysis;
  });
  const sorted = results.sort((a, b) => b.score - a.score);
  const valid = sorted.filter((r) => r.score >= 60);
  const warnings = sorted.filter((r) => r.score >= 30 && r.score < 60);
  const errors = sorted.filter((r) => r.score < 30);
  return { valid, warnings, errors, all: sorted };
}