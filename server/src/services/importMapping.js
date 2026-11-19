import { isDateString, normalize, toDateString } from '@anm/shared';

/**
 * Correspondance tolérante des fichiers d'import (notamment les classeurs
 * « réseaux sociaux » : CA, Commune, Liens, Type Anomalie, Statut, Date).
 * Le moteur reste côté serveur : il s'appuie sur les référentiels réels et
 * n'invente ni commune, ni daïra, ni type.
 */

const APOSTROPHE_RE = /[\u2018\u2019'`\u00b4]/g;
const NON_KEY_RE = /[^a-z0-9\u0600-\u06ff]+/g;
const pad = (value) => String(value).padStart(2, '0');

/** Clé de comparaison : sans accents, sans apostrophe, sans ponctuation. */
export function comparisonKey(value) {
  return normalize(String(value ?? ''))
    .replace(APOSTROPHE_RE, ' ')
    .replace(NON_KEY_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Date utile d'une cellule ExcelJS (les dates Excel n'ont pas de fuseau). */
function datePart(value) {
  if (value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0) {
    return value.toISOString().slice(0, 10);
  }
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/** Texte d'une cellule, en privilégiant le lien réel des cellules hyperlien. */
export function cellText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return datePart(value);
  if (typeof value === 'object') {
    if (typeof value.hyperlink === 'string' && value.hyperlink.trim()) return value.hyperlink.trim();
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('').trim();
    if (value.text !== null && value.text !== undefined) return String(value.text).trim();
    if (value.result !== null && value.result !== undefined) return cellText(value.result);
    if (value.error) return '';
    return '';
  }
  return String(value).trim();
}

/** Convertit une date de fichier en AAAA-MM-JJ (Date, série Excel, jj/mm/aaaa). */
export function parseImportDate(value) {
  if (value === null || value === undefined || value === '') return { date: null };
  if (value instanceof Date) return { date: datePart(value) };
  const text = String(value).trim();
  if (!text) return { date: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return isDateString(text) ? { date: text } : { date: null, error: `Date invalide : ${text}` };
  }
  const slash = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (slash) {
    const iso = `${slash[3]}-${pad(slash[2])}-${pad(slash[1])}`;
    return isDateString(iso) ? { date: iso } : { date: null, error: `Date invalide : ${text}` };
  }
  const serial = Number(text);
  if (Number.isFinite(serial) && serial >= 20000 && serial <= 80000) {
    return { date: toDateString(new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000)) };
  }
  return { date: null, error: `Date illisible : ${text}` };
}

function bigrams(text) {
  const compact = text.replace(/\s+/g, '');
  const grams = new Map();
  for (let index = 0; index < compact.length - 1; index += 1) {
    const gram = compact.slice(index, index + 2);
    grams.set(gram, (grams.get(gram) || 0) + 1);
  }
  return grams;
}

/** Similarité 0..1 tolérante aux fautes de frappe et aux variantes locales. */
export function similarity(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftTokens = new Set(left.split(' '));
  const rightTokens = new Set(right.split(' '));
  const subset = (small, large) => [...small].every((token) => large.has(token));
  if (subset(leftTokens, rightTokens) || subset(rightTokens, leftTokens)) return 0.93;
  if (left.includes(right) || right.includes(left)) return 0.9;
  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);
  let overlap = 0;
  let total = 0;
  for (const [gram, count] of leftGrams) {
    total += count;
    overlap += Math.min(count, rightGrams.get(gram) || 0);
  }
  for (const count of rightGrams.values()) total += count;
  return total ? (2 * overlap) / total : 0;
}

const DAIRA_ALIASES = { beraki: 'baraki' };

const COMMUNE_ALIASES = {
  kalitous: 'les eucalyptus',
  'el kalitous': 'les eucalyptus',
  'gue de constantine': 'djasr kasentina',
  'gue de canstantine': 'djasr kasentina',
  'gues de constantine': 'djasr kasentina',
  'sidi mhamed': 'sidi m hamed',
};

const GENERIC_TYPE_KEY = comparisonKey('عام');

/** Règles de lecture des libellés métier libres, du plus précis au plus général. */
const TYPE_RULES = [
  { pattern: /\bni[ds] de poule\b/, domaine: 'الطريق', type: 'حفرة' },
  { pattern: /\bavaloirs?\b|\bavaloires?\b|\bbouche d egout\b/, match: /bouch|obstru|combl/, domaine: 'البالوعات', type: 'مسدودة' },
  { pattern: /couvercle/, match: /absence|absent|manque|sans|enleve|vole|ouvert/, domaine: 'البالوعات', type: 'بدون غطاء' },
  { pattern: /\bavaloirs?\b|\bavaloires?\b/, match: /casse|effondr|brise|detruit|defonc/, domaine: 'البالوعات', type: 'محطمة' },
  { pattern: /telecom/, domaine: 'أقبية الأسلاك الهاتفية', type: 'غطاء القبو محطم' },
  { pattern: /caniveaux|caniveau|eau pluviale|eaux pluviales|pluvial|rigole/, domaine: 'مجاري مياه الأمطار', type: 'مجرى المياه مسدود' },
  { pattern: /candelabre|lampadaire|reverbere/, domaine: 'الإنارة العمومية', type: 'عمود إنارة آيل للسقوط' },
  { pattern: /eclairage|eclaire|lampe|lumiere|neon/, domaine: 'الإنارة العمومية', type: 'غياب الإنارة' },
  { pattern: /\bcables?\b|\bfils?\b electrique|\bfil electrique/, domaine: 'حالة الأعمدة الكهربائية', type: 'بروز الأسلاك' },
  { pattern: /\barbre\b|\barbres\b/, match: /chute|tombe|effondr|abattu|risque/, domaine: 'العناية بالأشجار', type: 'شجرة آيلة للسقوط' },
  { pattern: /\barbre\b|\barbres\b/, domaine: 'العناية بالأشجار', type: 'نقص في تقليم الأشجار' },
  { pattern: /\bmur\b|\bmurs\b|facade|effondr/, domaine: 'واجهات المباني', type: 'جدار آيل للسقوط' },
  { pattern: /drapeau|embleme/, domaine: 'الرايات الوطنية', type: 'راية ممزقة' },
  { pattern: /barriere|obstacle|glissiere|garde corps/, domaine: 'حواجز حديدية', type: 'حاجز مهترئ' },
  { pattern: /dechets? verts?|dechet vert|branchage|feuillage/, domaine: 'نفايات خضراء', type: 'مفرغة عشوائية' },
  { pattern: /dechets? menagers?|ordures menageres?|sacs? poubelle/, domaine: 'نفايات منزلية', type: 'تأخر في رفع النفايات' },
  { pattern: /\bbac\b|\bbaque\b|conteneur|poubelle/, match: /ordure|dechet/, domaine: 'حاويات القمامة', type: 'إهتراء الحاويات' },
  { pattern: /gravats|encombrants?|depotoir|decharge|dechets?|ordures/, domaine: 'النفايات الصلبة', type: 'مفرغة عشوائية' },
  { pattern: /balayage|balillage|balilage|balai|kens/, domaine: 'عملية الكنس', type: 'نقص في عملية الكنس' },
  { pattern: /lavage|lagage|nettoyage/, domaine: 'نقص في الغسل', type: 'عام' },
  { pattern: /tran[cs]on/, domaine: 'الطريق', type: 'عدم صيانة الطريق بعد إنتهاء الأشغال' },
  { pattern: /chaussee|route|voirie|asphalte|bitume/, domaine: 'الطريق', type: 'إهتراء' },
  { pattern: /trottoir/, domaine: 'أرصفة', type: 'إهتراء' },
  { pattern: /fuite/, match: /usees?|usee|eaux usees|egout|assain/, domaine: 'تسرب مياه الصرف الصحي', type: 'تسرب الصرف الصحي الفردي' },
  { pattern: /eaux usees|assainissement|egout/, domaine: 'تسرب مياه الصرف الصحي', type: 'مجمع مياه الصرف الصحي' },
  { pattern: /rejet/, domaine: 'تسرب مياه الصرف الصحي', type: 'مجمع مياه الصرف الصحي' },
  { pattern: /fuite|eau potable|conduite|canalisation/, domaine: 'تسرب المياه الصالحة للشرب', type: 'عام' },
  { pattern: /stagnation|stagnante|flaque|eau stagnante|mare/, domaine: 'ركود المياه', type: 'عام' },
  { pattern: /oued/, domaine: 'أودية', type: 'الصب المباشر لمياه الوادي' },
  { pattern: /\bamats?\b|\bterre\b|remblai|deblai/, domaine: 'أشغال طور الإنجاز', type: 'عام' },
];

const FALLBACK_TYPE = { domaine: 'أشغال طور الإنجاز', type: 'عام' };

const STATUT_ALIASES = new Map(Object.entries({
  non_traite: 'non_traite',
  non_traitee: 'non_traite',
  'non traite': 'non_traite',
  'non traitee': 'non_traite',
  a_traiter: 'non_traite',
  nouveau: 'non_traite',
  nouvelle: 'non_traite',
  signale: 'non_traite',
  signalee: 'non_traite',
  ouvert: 'non_traite',
  ouverte: 'non_traite',
  en_cours: 'en_cours',
  encours: 'en_cours',
  'en cours': 'en_cours',
  cours: 'en_cours',
  'en traitement': 'en_cours',
  traitement: 'en_cours',
  traite: 'traite',
  traitee: 'traite',
  traites: 'traite',
  regle: 'traite',
  reglee: 'traite',
  resolu: 'traite',
  resolue: 'traite',
  fait: 'traite',
  cloture: 'traite',
  cloturee: 'traite',
  termine: 'traite',
  terminee: 'traite',
}));

export function mapImportStatut(value) {
  const key = comparisonKey(value);
  if (!key) return { statut: null };
  const known = STATUT_ALIASES.get(key);
  if (known) return { statut: known };
  if (key.includes('cours')) return { statut: 'en_cours' };
  if (key.includes('traite') || key.includes('regl') || key.includes('resolu')) return { statut: 'traite' };
  return { statut: null, error: `Statut inconnu : ${value}` };
}

function referenceKey(value) {
  return comparisonKey(value);
}

function bestMatch(list, key, threshold) {
  let best = null;
  for (const item of list) {
    const score = Math.max(similarity(key, item.keyFr), similarity(key, item.keyAr));
    if (score >= threshold && (!best || score > best.score)) best = { ...item, score, approx: true };
  }
  return best;
}

/** Résout une daïra (exact, alias local, puis similarité). */
export function resolveDaira(dairas, value) {
  const key = referenceKey(value);
  if (!key) return null;
  const exact = dairas.find((item) => item.keyFr === key || item.keyAr === key);
  if (exact) return { ...exact, score: 1, approx: false };
  const alias = DAIRA_ALIASES[key];
  if (alias) {
    const target = dairas.find((item) => item.keyFr === alias);
    if (target) return { ...target, score: 0.99, approx: true };
  }
  return bestMatch(dairas, key, 0.84);
}

/** Résout une commune : d'abord dans la daïra, puis globalement. */
export function resolveCommune(communes, value, dairaId = null) {
  const key = referenceKey(value);
  if (!key) return null;
  const pick = (list, threshold) => {
    const exact = list.find((item) => item.keyFr === key || item.keyAr === key);
    if (exact) return { ...exact, score: 1, approx: false };
    const alias = COMMUNE_ALIASES[key];
    if (alias) {
      const target = list.find((item) => item.keyFr === alias);
      if (target) return { ...target, score: 0.99, approx: true };
    }
    return bestMatch(list, key, threshold);
  };
  const scoped = dairaId ? communes.filter((item) => Number(item.daira_id) === Number(dairaId)) : [];
  return (scoped.length ? pick(scoped, 0.82) : null) || pick(communes, 0.88);
}

function findRuleType(types, rule) {
  const domainKey = comparisonKey(rule.domaine);
  const typeKey = comparisonKey(rule.type);
  return types.find((item) => (item.domainKeyAr === domainKey || item.domainKeyFr === domainKey)
    && (item.typeKey === typeKey || (item.nameFrKey && item.nameFrKey === typeKey))) || null;
}

function matchesRule(rule, key) {
  return rule.pattern.test(key) && (!rule.match || rule.match.test(key));
}

/** Résout domaine + type : exact, règle métier, similarité, puis défaut. */
export function resolveType(types, rawType, rawCategory, { strict = false } = {}) {
  const categoryKey = referenceKey(rawCategory);
  let domainTypes = null;
  if (categoryKey) {
    domainTypes = types.filter((item) => item.domainKeyAr === categoryKey || item.domainKeyFr === categoryKey);
    if (!domainTypes.length) return { error: `Catégorie inconnue : ${rawCategory || '—'}` };
  }
  const pool = domainTypes || types;
  const typeKey = referenceKey(rawType);
  if (typeKey) {
    const exact = pool.find((item) => item.typeKey === typeKey || (item.nameFrKey && item.nameFrKey === typeKey));
    if (exact) return { type: exact, approx: false };
    const rule = TYPE_RULES.find((candidate) => matchesRule(candidate, typeKey));
    if (rule) {
      const target = findRuleType(types, rule);
      if (target && (!domainTypes || target.domaine_id === domainTypes[0].domaine_id)) return { type: target, approx: true };
    }
    if (domainTypes) {
      const generic = domainTypes.find((item) => item.typeKey === GENERIC_TYPE_KEY) || domainTypes[0];
      if (strict) return { error: `Type inconnu ou hors catégorie : ${rawType || '—'}` };
      return { type: generic, approx: true };
    }
    let best = null;
    for (const item of pool) {
      const score = Math.max(similarity(typeKey, item.typeKey), item.nameFrKey ? similarity(typeKey, item.nameFrKey) : 0);
      if (score >= 0.9 && (!best || score > best.score)) best = { ...item, score };
    }
    if (best) return { type: best, approx: true };
  }
  if (domainTypes) {
    const generic = domainTypes.find((item) => item.typeKey === GENERIC_TYPE_KEY) || domainTypes[0];
    return { type: generic, approx: Boolean(typeKey) };
  }
  if (strict) return { error: `Type inconnu ou hors catégorie : ${rawType || '—'}` };
  const fallback = findRuleType(types, FALLBACK_TYPE);
  if (!fallback) return { error: 'Taxonomie indisponible : aucun type par défaut' };
  return { type: fallback, approx: Boolean(typeKey) };
}

/** Index des référentiels, construit une fois par import. */
export function buildReferenceIndex(db) {
  const domaines = db.prepare('SELECT id, name_ar, name_fr FROM domaines WHERE actif = 1 ORDER BY ordre, id').all();
  const domainById = new Map(domaines.map((domain) => [domain.id, domain]));
  const types = db.prepare('SELECT id, domaine_id, name_ar, name_fr FROM types_anomalie WHERE actif = 1 ORDER BY domaine_id, ordre, id').all()
    .map((type) => {
      const domain = domainById.get(type.domaine_id);
      return {
        id: type.id,
        domaine_id: type.domaine_id,
        typeKey: comparisonKey(type.name_ar),
        nameFrKey: comparisonKey(type.name_fr),
        label: type.name_fr || type.name_ar,
        domainLabel: domain?.name_fr || domain?.name_ar || '',
        domainKeyAr: comparisonKey(domain?.name_ar),
        domainKeyFr: comparisonKey(domain?.name_fr),
      };
    });
  const dairas = db.prepare('SELECT id, name_fr, name_ar FROM dairas WHERE actif = 1 ORDER BY name_fr, id').all()
    .map((daira) => ({
      id: daira.id,
      label: daira.name_fr || daira.name_ar,
      keyFr: comparisonKey(daira.name_fr),
      keyAr: comparisonKey(daira.name_ar),
    }));
  const communes = db.prepare('SELECT id, daira_id, name_fr, name_ar FROM communes WHERE actif = 1 ORDER BY name_fr, id').all()
    .map((commune) => ({
      id: commune.id,
      daira_id: commune.daira_id,
      label: commune.name_fr || commune.name_ar,
      keyFr: comparisonKey(commune.name_fr),
      keyAr: comparisonKey(commune.name_ar),
    }));
  return { types, dairas, communes };
}
