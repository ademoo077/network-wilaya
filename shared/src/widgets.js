/**
 * Galerie V8.2 : widgets prêts à l'emploi, exprimés **uniquement** avec le
 * catalogue V8 (aucun SQL). Chaque définition est une requête `herite` : la
 * période réelle est injectée par la synthèse ou l'édition.
 */
import { CATALOGUE } from './catalogue.js';
import { describeRequete } from './describe.js';

const m = (id) => ({ id });
const d = (champ, granularite) => (granularite ? { champ, granularite } : { champ });
const req = ({ mesures, dimensions = [], filtres = [], ...rest }) => ({
  dataset: 'anomalies',
  mesures,
  dimensions,
  filtres,
  periode: { mode: 'herite' },
  ...rest,
});

function widget(id, famille, titreFr, titreAr, visuel, requete, options) {
  return { id, famille, titre_fr: titreFr, titre_ar: titreAr, visuel, requete, ...(options ? { options } : {}) };
}

export const GALERIE_FAMILLES = [
  { id: 'vue', label_fr: 'Vue d’ensemble', label_ar: 'نظرة عامة' },
  { id: 'delais', label_fr: 'Délais et SLA', label_ar: 'المدد والآجال' },
  { id: 'categories', label_fr: 'Catégories', label_ar: 'الفئات' },
  { id: 'territoire', label_fr: 'Territoire', label_ar: 'الإقليم' },
  { id: 'acteurs', label_fr: 'Acteurs', label_ar: 'الفاعلون' },
  { id: 'plateformes', label_fr: 'Plateformes', label_ar: 'المنصات' },
  { id: 'qualite', label_fr: 'Qualité', label_ar: 'الجودة' },
  { id: 'listes', label_fr: 'Listes et tableaux', label_ar: 'القوائم والجداول' },
  { id: 'texte', label_fr: 'Texte et mise en page', label_ar: 'النص والتنسيق' },
];

export const GALERIE = [
  widget('recues-kpi', 'vue', 'Fiches reçues', 'البطاقات المستلمة', 'kpi',
    req({ mesures: [m('recues')], comparaison: 'periode_precedente' })),
  widget('traitees-kpi', 'vue', 'Traitées dans la période', 'المعالجة خلال الفترة', 'kpi',
    req({ mesures: [m('traitees_periode')], comparaison: 'periode_precedente' })),
  widget('taux-traitement-kpi', 'vue', 'Taux de traitement', 'معدل المعالجة', 'kpi',
    req({ mesures: [m('taux_traitement')], comparaison: 'periode_precedente' })),
  widget('statut-anneau', 'vue', 'Répartition par statut', 'التوزيع حسب الحالة', 'anneau',
    req({ mesures: [m('recues')], dimensions: [d('statut')] })),
  widget('stock-fin-kpi', 'vue', 'Stock ouvert en fin de période', 'المخزون المفتوح نهاية الفترة', 'kpi',
    req({ mesures: [m('stock_fin')], comparaison: 'periode_precedente' })),
  widget('variation-stock-kpi', 'vue', 'Variation du stock', 'تغير المخزون', 'kpi',
    req({ mesures: [m('variation_stock')], comparaison: 'periode_precedente' })),
  widget('recues-traitees-courbe', 'vue', 'Reçues et traitées par semaine', 'المستلمة والمعالجة أسبوعياً', 'courbe',
    req({ mesures: [m('recues'), m('traitees_periode')], dimensions: [d('signalement', 'semaine')] })),
  widget('cascade-stock', 'vue', 'Cascade du stock', 'تسلسل المخزون', 'cascade',
    req({ mesures: [m('stock_debut'), m('stock_fin'), m('variation_stock')] })),

  widget('delai-moyen-kpi', 'delais', 'Délai moyen de traitement', 'متوسط مدة المعالجة', 'kpi',
    req({ mesures: [m('delai_moyen')], comparaison: 'periode_precedente' })),
  widget('delai-median-kpi', 'delais', 'Délai médian', 'الوسيط', 'kpi',
    req({ mesures: [m('delai_median')], comparaison: 'periode_precedente' })),
  widget('delai-p90-kpi', 'delais', 'Délai P90', 'المئين 90', 'kpi',
    req({ mesures: [m('delai_p90')], comparaison: 'periode_precedente' })),
  widget('delais-histogramme', 'delais', 'Distribution des délais', 'توزيع المدد', 'histogramme',
    req({ mesures: [m('recues')], dimensions: [d('tranche_delai')] })),
  widget('taux-sla-kpi', 'delais', 'Respect du SLA', 'احترام الأجل', 'kpi',
    req({ mesures: [m('taux_sla')], comparaison: 'periode_precedente' })),
  widget('age-stock-barres', 'delais', 'Âge du stock ouvert', 'عمر المخزون المفتوح', 'barres',
    req({ mesures: [m('stock_fin')], dimensions: [d('tranche_age')] })),
  widget('urgentes-kpi', 'delais', 'Urgentes encore ouvertes', 'العاجلة المفتوحة', 'kpi',
    req({ mesures: [m('urgentes_ouvertes')], comparaison: 'periode_precedente' })),

  widget('domaine-treemap', 'categories', 'Par catégorie', 'حسب الفئة', 'treemap',
    req({ mesures: [m('recues')], dimensions: [d('domaine')] })),
  widget('groupe-barres', 'categories', 'Par groupe thématique', 'حسب المجموعة الموضوعية', 'barres',
    req({ mesures: [m('recues')], dimensions: [d('groupe')] })),
  widget('type-statut-empile', 'categories', 'Types par statut', 'الأنواع حسب الحالة', 'barres',
    req({ mesures: [m('recues')], dimensions: [d('type'), d('statut')] })),
  widget('pareto-types', 'categories', 'Pareto des types', 'باريتو الأنواع', 'pareto',
    req({ mesures: [m('recues'), m('pct_cumule')], dimensions: [d('type')], tri: [{ champ: 'recues', dir: 'desc' }], limite: 12 })),
  widget('top-types', 'categories', 'Top 5 des types', 'أفضل 5 أنواع', 'classement',
    req({ mesures: [m('recues')], dimensions: [d('type')], tri: [{ champ: 'recues', dir: 'desc' }], limite: 5 })),
  widget('domaine-statut-thermique', 'categories', 'Catégories × statut', 'الفئات × الحالة', 'carte_thermique',
    req({ mesures: [m('recues')], dimensions: [d('domaine'), d('statut')] })),

  widget('daira-barres', 'territoire', 'Par daïra', 'حسب الدائرة', 'barres',
    req({ mesures: [m('recues')], dimensions: [d('daira')] })),
  widget('top-communes', 'territoire', 'Top 10 des communes', 'أفضل 10 بلديات', 'classement',
    req({ mesures: [m('recues')], dimensions: [d('commune')], tri: [{ champ: 'recues', dir: 'desc' }], limite: 10 })),
  widget('points-noirs', 'territoire', 'Points noirs récurrents', 'النقاط السوداء المتكررة', 'barres',
    req({ mesures: [m('nb_recurrents')], dimensions: [d('commune')], tri: [{ champ: 'nb_recurrents', dir: 'desc' }], limite: 10 })),
  widget('daira-type-thermique', 'territoire', 'Daïras × types', 'الدوائر × الأنواع', 'carte_thermique',
    req({ mesures: [m('recues')], dimensions: [d('daira'), d('type')] })),
  widget('couverture-territoriale-kpi', 'territoire', 'Daïras touchées', 'الدوائر المعنية', 'kpi',
    req({ mesures: [m('nb_dairas_touchees')], comparaison: 'periode_precedente' })),

  widget('performance-epic-tableau', 'acteurs', 'Performance des EPIC', 'أداء المؤسسات', 'tableau',
    req({ mesures: [m('recues'), m('traitees_periode'), m('stock_fin')], dimensions: [d('epic')] })),
  widget('charge-agent', 'acteurs', 'Charge par agent', 'العبء حسب العون', 'barres',
    req({ mesures: [m('recues')], dimensions: [d('agent')], tri: [{ champ: 'recues', dir: 'desc' }], limite: 10 })),
  widget('confirmation-agent', 'acteurs', 'Taux de confirmation par agent', 'معدل التأكيد حسب العون', 'barres',
    req({ mesures: [m('taux_confirmation')], dimensions: [d('agent')] })),
  widget('delai-verification-kpi', 'acteurs', 'Délai de vérification', 'مدة التحقق', 'kpi',
    req({ mesures: [m('delai_verification_moyen')], comparaison: 'periode_precedente' })),

  widget('plateforme-anneau', 'plateformes', 'Répartition par plateforme', 'التوزيع حسب المنصة', 'anneau',
    req({ mesures: [m('recues')], dimensions: [d('plateforme')] })),
  widget('delai-plateforme', 'plateformes', 'Délai par plateforme', 'المدة حسب المنصة', 'barres',
    req({ mesures: [m('delai_moyen')], dimensions: [d('plateforme')] })),
  widget('part-veille-kpi', 'plateformes', 'Fiches issues de la veille', 'بطاقات من الرصد', 'kpi',
    req({ mesures: [m('recues')], filtres: [{ champ: 'source_saisie', op: 'in', valeur: ['veille'] }], comparaison: 'periode_precedente' })),

  widget('geolocalisation-kpi', 'qualite', 'Taux de géolocalisation', 'معدل التموقع', 'kpi',
    req({ mesures: [m('taux_geolocalisation')], comparaison: 'periode_precedente' })),
  widget('gps-source-anneau', 'qualite', 'Source des coordonnées', 'مصدر الإحداثيات', 'anneau',
    req({ mesures: [m('recues')], dimensions: [d('gps_source')] })),
  widget('pieces-jointes-anneau', 'qualite', 'Fiches avec pièces jointes', 'بطاقات مع مرفقات', 'anneau',
    req({ mesures: [m('recues')], dimensions: [d('a_pieces_jointes')] })),
  widget('en-retard-kpi', 'qualite', 'Fiches en retard', 'بطاقات متأخرة', 'kpi',
    req({ mesures: [m('en_retard')], comparaison: 'periode_precedente' })),

  widget('urgentes-liste', 'listes', 'Urgentes par priorité', 'العاجلة حسب الأولوية', 'tableau',
    req({ mesures: [m('urgentes_ouvertes'), m('stock_fin')], dimensions: [d('priorite')] })),
  widget('recues-statut-liste', 'listes', 'Fiches reçues par statut', 'البطاقات المستلمة حسب الحالة', 'tableau',
    req({ mesures: [m('recues'), m('cohorte_pct_traitees')], dimensions: [d('statut')] })),

  widget('commentaire-texte', 'texte', 'Commentaire du rédacteur', 'تعليق المحرر', 'texte', undefined,
    { texte_fr: '', texte_ar: '', editable: true }),
  widget('faits-marquants', 'texte', 'Faits marquants', 'الوقائع البارزة', 'texte', undefined,
    { auto: 'faits_marquants', texte_fr: '', texte_ar: '' }),
  widget('signature', 'texte', 'Signature', 'التوقيع', 'signature', undefined,
    { texte_fr: 'La Cellule technique de numérisation — Wilaya d’Alger', texte_ar: 'الخلية التقنية للرقمنة — ولاية الجزائر' }),
];

const TIME_DIMENSIONS = new Set(['signalement', 'traitement', 'date_verification', 'intervention', 'publication']);
const DISTRIBUTION_DIMENSIONS = new Set(['tranche_age', 'tranche_delai']);
const RING_DIMENSIONS = new Set([
  'statut', 'statut_fin', 'verification', 'priorite', 'plateforme', 'gps', 'gps_source',
  'gps_verifiee', 'recurrent', 'a_pieces_jointes', 'en_retard', 'hors_sla', 'contenu_type', 'source_saisie',
]);

/** Visuel recommandé par les règles V8.2 (jamais choisi côté serveur). */
export function recommendedVisual(requete) {
  const dimensions = requete?.dimensions || [];
  const mesures = requete?.mesures || [];
  if (!dimensions.length) return 'kpi';
  const ids = dimensions.map((dimension) => String(dimension.champ).replace(/^t\./, ''));
  if (ids.length >= 2) return 'carte_thermique';
  const [id] = ids;
  if (TIME_DIMENSIONS.has(id)) return 'courbe';
  if (DISTRIBUTION_DIMENSIONS.has(id)) return 'histogramme';
  if (RING_DIMENSIONS.has(id)) return 'anneau';
  if (mesures.some((mesure) => CATALOGUE.mesures[mesure.id]?.format === 'pourcentage')) return 'anneau';
  return 'barres';
}

/** Galerie enrichie de la phrase de synthèse FR/AR (aperçu et légende). */
export function galeriePayload(lang = 'fr') {
  return GALERIE.map((item) => ({
    ...item,
    description: item.requete ? describeRequete(item.requete, lang) : null,
  }));
}
