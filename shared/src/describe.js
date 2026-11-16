/**
 * Narration automatique V8 (§ 10) : transforme une requête validée en phrase
 * lisible, en français ou en arabe. Fonction partagée par le Lab, la synthèse,
 * l’inspecteur et les légendes de filtres — une seule formulation, testée.
 *
 * Aucune donnée n’est calculée ici : uniquement les libellés du catalogue.
 */
import { CATALOGUE } from './catalogue.js';

const SEP = { fr: ' ; ', ar: ' ؛ ' };

function labelOf(item, lang) {
  if (!item) return '';
  return lang === 'ar' ? (item.label_ar || item.label_fr || item.id || '') : (item.label_fr || item.label_ar || item.id || '');
}

function scalarLabel(value, lang) {
  if (value === true) return lang === 'ar' ? 'نعم' : 'Oui';
  if (value === false) return lang === 'ar' ? 'لا' : 'Non';
  if (value === null || value === undefined || value === '') return lang === 'ar' ? 'فارغ' : 'vide';
  return String(value);
}

function filterValue(filtre, value, lang) {
  if (filtre?.valeurs) {
    const found = filtre.valeurs.find((entry) => String(entry.id) === String(value));
    if (found) return labelOf(found, lang);
  }
  return scalarLabel(value, lang);
}

const OPS_FR = {
  in: 'parmi', not_in: 'sauf', eq: '=', gt: '>', gte: '≥', lt: '<', lte: '≤',
  between: 'entre', contains: 'contient', is_null: 'est vide',
};
const OPS_AR = {
  in: 'من بين', not_in: 'باستثناء', eq: '=', gt: '>', gte: '≥', lt: '<', lte: '≤',
  between: 'بين', contains: 'يحتوي', is_null: 'فارغ',
};

/** Décrit un filtre unique, ou une chaîne vide s’il est inexploitable. */
export function describeFiltre(filtre, lang = 'fr') {
  if (!filtre || !filtre.champ) return '';
  const meta = CATALOGUE.filtres[filtre.champ];
  const label = labelOf(meta, lang);
  const op = (lang === 'ar' ? OPS_AR : OPS_FR)[filtre.op] || filtre.op;
  const value = filtre.valeur;
  if (filtre.op === 'in' || filtre.op === 'not_in') {
    const items = Array.isArray(value) ? value.map((entry) => filterValue(meta, entry, lang)) : [];
    return `${label} ${op} ${items.join(', ')}`;
  }
  if (filtre.op === 'between') {
    const range = Array.isArray(value) ? value : [];
    return `${label} ${op} ${scalarLabel(range[0], lang)} ${lang === 'ar' ? 'و' : 'et'} ${scalarLabel(range[1], lang)}`;
  }
  if (filtre.op === 'is_null') {
    const present = value === false;
    if (lang === 'ar') return present ? `${label} معبأ` : `${label} فارغ`;
    return present ? `${label} renseigné` : `${label} vide`;
  }
  if (filtre.op === 'contains') {
    return `${label} ${op} « ${scalarLabel(value, lang)} »`;
  }
  return `${label} ${op} ${filterValue(meta, value, lang)}`;
}

/** Liste des filtres appliqués, dans l’ordre de la requête. */
export function describeFiltres(spec, lang = 'fr') {
  return (spec?.filtres || []).map((filtre) => describeFiltre(filtre, lang)).filter(Boolean);
}

function describePeriode(periode, lang) {
  if (!periode || periode.mode === 'herite') {
    return lang === 'ar' ? 'فترة التقرير' : 'période de la synthèse';
  }
  if (periode.mode === 'semaine') return lang === 'ar' ? 'هذا الأسبوع' : 'cette semaine';
  if (periode.mode === 'mois') return lang === 'ar' ? 'هذا الشهر' : 'ce mois-ci';
  if (periode.mode === 'glissant') {
    const jours = Number(periode.jours) || 0;
    return lang === 'ar' ? `آخر ${jours} يوماً` : `${jours} derniers jours`;
  }
  if (periode.mode === 'plage') {
    const debut = periode.debut || '—';
    const fin = periode.fin || '—';
    return lang === 'ar' ? `من ${debut} إلى ${fin}` : `du ${debut} au ${fin}`;
  }
  return '';
}

function describeComparaison(spec, lang) {
  const mode = spec?.comparaison;
  if (!mode || mode === 'aucune') return '';
  if (mode === 'periode_precedente') {
    return lang === 'ar' ? 'مقارنة بالفترة السابقة' : 'comparé à la période précédente';
  }
  if (mode === 'meme_periode_n-1') {
    return lang === 'ar' ? 'مقارنة بنفس الفترة من السنة الماضية' : 'comparé à la même période l’an dernier';
  }
  if (mode === 'moyenne_4') {
    return lang === 'ar' ? 'مقارنة بمتوسط 4 فترات' : 'comparé à la moyenne des 4 périodes précédentes';
  }
  if (mode === 'periode_libre') {
    const debut = spec.comparaison_debut || '—';
    const fin = spec.comparaison_fin || '—';
    return lang === 'ar' ? `مقارنة بالفترة من ${debut} إلى ${fin}` : `comparé à la période du ${debut} au ${fin}`;
  }
  return '';
}

/** Phrase de synthèse en langage clair, ex. « Fiches reçues, par daïra, cette semaine. » */
export function describeRequete(spec, lang = 'fr') {
  if (!spec || typeof spec !== 'object') return '';
  const ar = lang === 'ar';
  const mesures = (spec.mesures || [])
    .map((mesure) => labelOf(CATALOGUE.mesures[mesure.id], lang))
    .filter(Boolean);
  if (!mesures.length) return '';
  const dimensions = (spec.dimensions || []).map((dimension) => {
    const meta = CATALOGUE.dimensions[String(dimension.champ || '').replace(/^t\./, '')];
    if (!meta) return '';
    const base = labelOf(meta, lang);
    const granularite = dimension.granularite ? CATALOGUE.granularites[dimension.granularite] : null;
    return granularite ? `${base} (${labelOf(granularite, lang)})` : base;
  }).filter(Boolean);
  const filtres = describeFiltres(spec, lang);
  const periode = describePeriode(spec.periode, lang);
  const comparaison = describeComparaison(spec, lang);

  let phrase = mesures.join(ar ? ' و ' : ' et ');
  if (dimensions.length) phrase += ar ? `، حسب ${dimensions.join(' و ')}` : `, par ${dimensions.join(' et ')}`;
  if (filtres.length) phrase += ar ? `، ${filtres.join(SEP.ar)}` : `, ${filtres.join(SEP.fr)}`;
  if (periode) phrase += ar ? `، ${periode}` : `, ${periode}`;
  if (comparaison) phrase += ar ? `، ${comparaison}` : `, ${comparaison}`;
  return `${phrase}.`;
}
