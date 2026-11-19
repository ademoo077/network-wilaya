/**
 * Catalogue sémantique V8 (§ 4) — liste blanche unique.
 *
 * Aucune requête libre : le client ne peut choisir que des `id` présents ici.
 * Le compilateur serveur associe chaque `id` à une expression SQL paramétrée.
 * Chaque entrée expose FR + AR + description (vérifié par les tests).
 */
import {
  CONTENU_TYPES, GPS_SOURCES, PLATEFORMES, PRIORITES, STATUTS, VERIFICATIONS,
} from './constants.js';
import { FORMAT_IDS } from './format.js';

export const CATALOGUE_VERSION = '8.0.0';

const PLATFORM_LABELS = {
  facebook: ['Facebook', 'فيسبوك'],
  instagram: ['Instagram', 'إنستغرام'],
  tiktok: ['TikTok', 'تيك توك'],
  youtube: ['YouTube', 'يوتيوب'],
  x: ['X', 'إكس'],
  whatsapp: ['WhatsApp', 'واتساب'],
  telegram: ['Telegram', 'تلغرام'],
  autre: ['Autre', 'أخرى'],
};
const PRIORITY_LABELS = { normale: ['Normale', 'عادية'], haute: ['Haute', 'عالية'], urgente: ['Urgente', 'عاجلة'] };
const STATUT_LABELS = {
  non_traite: ['Non traitées', 'غير معالجة'],
  en_cours: ['En cours', 'قيد المعالجة'],
  traite: ['Traitées', 'معالجة'],
};
const VERIFICATION_LABELS = {
  a_verifier: ['À vérifier', 'بانتظار التحقق'],
  confirmee: ['Confirmées', 'مؤكدة'],
  infirmee: ['Infirmées', 'منفية'],
};
const GPS_SOURCE_LABELS = {
  manuel: ['Manuel', 'يدوي'],
  lien_carte: ['Lien carte', 'رابط خريطة'],
  lien_court: ['Lien court', 'رابط قصير'],
  legende: ['Légende', 'تعليق'],
  exif: ['EXIF', 'بيانات EXIF'],
  appareil: ['Appareil', 'الجهاز'],
  carte: ['Carte', 'الخريطة'],
  voisinage: ['Voisinage', 'الجوار'],
};
const CONTENU_LABELS = {
  reel: ['Reel', 'ريل'],
  video: ['Vidéo', 'فيديو'],
  post: ['Publication', 'منشور'],
  story: ['Story', 'ستوري'],
  short: ['Short', 'شورت'],
  photo: ['Photo', 'صورة'],
  direct: ['Direct', 'بث مباشر'],
  autre: ['Autre', 'أخرى'],
};

const ouiNon = [
  { id: 1, label_fr: 'Oui', label_ar: 'نعم' },
  { id: 0, label_fr: 'Non', label_ar: 'لا' },
];

function enumValues(map, ids) {
  return ids.map((id) => ({ id, label_fr: map[id][0], label_ar: map[id][1] }));
}

/** Jeux de données. Seul `anomalies` est évaluable en P1. */
export const DATASETS = [
  {
    id: 'anomalies',
    label_fr: 'Anomalies',
    label_ar: 'الاختلالات',
    description_fr: 'Fiches d’anomalies : population de base V4 (non supprimées, non infirmées sauf bascule).',
    description_ar: 'بطاقات الاختلالات: القاعدة الأساسية (غير المحذوفة وغير المنفية إلا بتفعيل الخيار).',
    disponible: true,
  },
  {
    id: 'transitions',
    label_fr: 'Transitions',
    label_ar: 'التحولات',
    description_fr: 'Historique des changements de statut et de champs (jeu prévu en P2).',
    description_ar: 'سجل تغييرات الحالة والحقول (مقرر في المرحلة الثانية).',
    disponible: false,
  },
  {
    id: 'veille',
    label_fr: 'Veille citoyenne',
    label_ar: 'الرصد المواطني',
    description_fr: 'Éléments de veille V7 (jeu prévu en P2).',
    description_ar: 'عناصر الرصد (مقرر في المرحلة الثانية).',
    disponible: false,
  },
  {
    id: 'referentiels',
    label_fr: 'Référentiels',
    label_ar: 'المراجع',
    description_fr: 'Jointures de libellés, non exposé seul.',
    description_ar: 'ربط التسميات، غير معروض بمفرده.',
    disponible: false,
  },
];

/** Granularités temporelles. */
export const GRANULARITES = [
  { id: 'jour', label_fr: 'Jour', label_ar: 'يوم', description_fr: 'Un point par jour.', description_ar: 'نقطة لكل يوم.' },
  { id: 'semaine', label_fr: 'Semaine', label_ar: 'أسبوع', description_fr: 'Semaine commençant selon le réglage `week_start_day`.', description_ar: 'أسبوع يبدأ حسب إعداد بداية الأسبوع.' },
  { id: 'mois', label_fr: 'Mois', label_ar: 'شهر', description_fr: 'Mois calendaire.', description_ar: 'شهر تقويمي.' },
  { id: 'trimestre', label_fr: 'Trimestre', label_ar: 'ربع', description_fr: 'Trimestre calendaire.', description_ar: 'ربع تقويمي.' },
  { id: 'annee', label_fr: 'Année', label_ar: 'سنة', description_fr: 'Année calendaire.', description_ar: 'سنة تقويمية.' },
  { id: 'jour_semaine', label_fr: 'Jour de la semaine', label_ar: 'يوم الأسبوع', description_fr: '0 = dimanche … 6 = samedi.', description_ar: '0 = الأحد … 6 = السبت.' },
];

/** Opérateurs de filtre autorisés (liste blanche). */
export const OPS = [
  { id: 'in', label_fr: 'parmi', label_ar: 'من بين', description_fr: 'Valeur incluse dans une liste.', description_ar: 'قيمة ضمن قائمة.' },
  { id: 'not_in', label_fr: 'sauf', label_ar: 'باستثناء', description_fr: 'Valeur exclue d’une liste.', description_ar: 'قيمة مستثناة من قائمة.' },
  { id: 'eq', label_fr: 'égal à', label_ar: 'يساوي', description_fr: 'Égalité stricte.', description_ar: 'مساواة تامة.' },
  { id: 'between', label_fr: 'entre', label_ar: 'بين', description_fr: 'Bornes incluses.', description_ar: 'الحدود مشمولة.' },
  { id: 'gt', label_fr: 'supérieur à', label_ar: 'أكبر من', description_fr: 'Strictement supérieur.', description_ar: 'أكبر تماما.' },
  { id: 'gte', label_fr: 'supérieur ou égal', label_ar: 'أكبر أو يساوي', description_fr: 'Supérieur ou égal.', description_ar: 'أكبر أو يساوي.' },
  { id: 'lt', label_fr: 'inférieur à', label_ar: 'أصغر من', description_fr: 'Strictement inférieur.', description_ar: 'أصغر تماما.' },
  { id: 'lte', label_fr: 'inférieur ou égal', label_ar: 'أصغر أو يساوي', description_fr: 'Inférieur ou égal.', description_ar: 'أصغر أو يساوي.' },
  { id: 'contains', label_fr: 'contient', label_ar: 'يحتوي', description_fr: 'Recherche textuelle normalisée.', description_ar: 'بحث نصي مطبع.' },
  { id: 'is_null', label_fr: 'est vide', label_ar: 'فارغ', description_fr: 'Valeur absente (`valeur` = true) ou présente (false).', description_ar: 'قيمة غائبة (true) أو موجودة (false).' },
];

/** Formats d’affichage. */
export const FORMATS = [
  { id: 'entier', label_fr: 'Entier', label_ar: 'عدد صحيح', description_fr: 'Nombre sans décimale.', description_ar: 'عدد بدون كسور.' },
  { id: 'decimal', label_fr: 'Décimal', label_ar: 'عدد عشري', description_fr: 'Une décimale.', description_ar: 'رقم عشري واحد.' },
  { id: 'pourcentage', label_fr: 'Pourcentage', label_ar: 'نسبة مئوية', description_fr: 'Une décimale, somme des parties = 100,0 %.', description_ar: 'رقم عشري واحد، مجموع الأجزاء = 100,0 %.' },
  { id: 'jours', label_fr: 'Jours', label_ar: 'أيام', description_fr: 'Durée en jours.', description_ar: 'مدة بالأيام.' },
  { id: 'n_pct', label_fr: 'n (x %)', label_ar: 'n (x %)', description_fr: 'Effectif et part.', description_ar: 'العدد والنسبة.' },
  { id: 'date', label_fr: 'Date', label_ar: 'تاريخ', description_fr: 'Date JJ/MM/AAAA.', description_ar: 'تاريخ يوم/شهر/سنة.' },
];

const dim = (id, kind, labelFr, labelAr, descriptionFr, descriptionAr, extra = {}) => ({
  id,
  type: 'dimension',
  dataset: 'anomalies',
  kind,
  label_fr: labelFr,
  label_ar: labelAr,
  description_fr: descriptionFr,
  description_ar: descriptionAr,
  ...extra,
});

/** Dimensions du jeu `anomalies`. */
export const DIMENSIONS = [
  dim('domaine', 'classification', 'Catégorie', 'المجال',
    'Catégorie principale de l’anomalie (référentiel domaine).',
    'الفئة الأساسية للاختلال (مرجع المجال).'),
  dim('groupe', 'classification', 'Groupe thématique', 'المجموعة الموضوعية',
    'Groupe de catégories (référentiel groupes).',
    'مجموعة الفئات (مرجع المجموعات).'),
  dim('type', 'classification', 'Type', 'النوع',
    'Type précis de l’anomalie, rattaché à une catégorie.',
    'النوع الدقيق للاختلال، مرتبط بفئة.'),

  dim('daira', 'territory', 'Daïra', 'الدائرة',
    'Daïra de rattachement de la fiche.',
    'الدائرة التي تنتمي إليها البطاقة.'),
  dim('commune', 'territory', 'Commune', 'البلدية',
    'Commune de rattachement de la fiche.',
    'البلدية التي تنتمي إليها البطاقة.'),
  dim('cellule_100m', 'territory', 'Cellule 100 m', 'خلية 100 م',
    'Grille d’environ 100 m calculée depuis les coordonnées GPS.',
    'شبكة حوالي 100 م محسوبة من الإحداثيات.'),

  dim('epic', 'actor', 'EPIC', 'المؤسسة العمومية',
    'Établissement public intervenant sur l’anomalie.',
    'المؤسسة العمومية المتدخلة.'),
  dim('agent', 'actor', 'Agent', 'العون',
    'Agent ayant vérifié ou traité la fiche.',
    'العون الذي تحقق من البطاقة أو عالجها.'),
  dim('saisi_par', 'actor', 'Saisi par', 'المُدخل',
    'Utilisateur ayant créé la fiche.',
    'المستخدم الذي أنشأ البطاقة.'),

  dim('statut', 'attribute', 'Statut actuel', 'الحالة الحالية',
    'Statut enregistré de la fiche (ou statut à la fin de période selon le mode).',
    'الحالة المسجلة للبطاقة (أو حالة نهاية الفترة حسب الوضع).',
    { valeurs: enumValues(STATUT_LABELS, STATUTS) }),
  dim('statut_fin', 'attribute', 'Statut à la fin de période', 'الحالة في نهاية الفترة',
    'Statut reconstitué à la date de fin de période (`statutAu`).',
    'الحالة المعاد تكوينها في تاريخ نهاية الفترة.',
    { valeurs: enumValues(STATUT_LABELS, STATUTS) }),
  dim('verification', 'attribute', 'Vérification', 'التحقق',
    'Résultat de la vérification terrain.',
    'نتيجة التحقق الميداني.',
    { valeurs: enumValues(VERIFICATION_LABELS, VERIFICATIONS) }),
  dim('priorite', 'attribute', 'Priorité', 'الأولوية',
    'Niveau de priorité de la fiche.',
    'مستوى أولوية البطاقة.',
    { valeurs: enumValues(PRIORITY_LABELS, PRIORITES) }),
  dim('plateforme', 'attribute', 'Plateforme', 'المنصة',
    'Plateforme d’origine de la publication.',
    'المنصة الأصلية للمنشور.',
    { valeurs: enumValues(PLATFORM_LABELS, PLATEFORMES) }),
  dim('contenu_type', 'attribute', 'Type de contenu', 'نوع المحتوى',
    'Format de la publication d’origine.',
    'شكل المنشور الأصلي.',
    { valeurs: enumValues(CONTENU_LABELS, CONTENU_TYPES) }),
  dim('source_saisie', 'attribute', 'Source de saisie', 'مصدر الإدخال',
    'Origine de la fiche : manuelle, import, veille ou duplication.',
    'أصل البطاقة: يدوي، استيراد، رصد أو نسخ.',
    {
      valeurs: [
        { id: 'manuelle', label_fr: 'Manuelle', label_ar: 'يدوية' },
        { id: 'import', label_fr: 'Import', label_ar: 'استيراد' },
        { id: 'veille', label_fr: 'Veille', label_ar: 'رصد' },
        { id: 'duplication', label_fr: 'Duplication', label_ar: 'نسخ' },
      ],
    }),
  dim('gps', 'attribute', 'GPS', 'الإحداثيات',
    'Présence de coordonnées GPS valides.',
    'وجود إحداثيات صالحة.',
    { valeurs: ouiNon }),
  dim('gps_source', 'attribute', 'Source GPS', 'مصدر الإحداثيات',
    'Méthode d’obtention des coordonnées.',
    'طريقة الحصول على الإحداثيات.',
    { valeurs: enumValues(GPS_SOURCE_LABELS, GPS_SOURCES) }),
  dim('gps_verifiee', 'attribute', 'GPS confirmé', 'تأكيد الإحداثيات',
    'Coordonnées confirmées sur place.',
    'إحداثيات مؤكدة ميدانيا.',
    { valeurs: ouiNon }),
  dim('recurrent', 'attribute', 'Récurrent', 'متكرر',
    'Fiche liée à une fiche mère (anomalie récurrente).',
    'بطاقة مرتبطة ببطاقة أم (اختلال متكرر).',
    { valeurs: ouiNon }),
  dim('a_pieces_jointes', 'attribute', 'Avec pièces jointes', 'مع مرفقات',
    'Au moins une pièce jointe est associée à la fiche.',
    'توجد مرفقات واحدة على الأقل مرتبطة بالبطاقة.',
    { valeurs: ouiNon }),
  dim('en_retard', 'attribute', 'En retard', 'متأخر',
    'Stock ouvert plus ancien que le délai de retard configuré.',
    'مخزون مفتوح أقدم من أجل التأخر المضبوط.',
    { valeurs: ouiNon }),
  dim('hors_sla', 'attribute', 'Hors SLA', 'خارج أجل المعالجة',
    'Fiche traitée au-delà de l’objectif de délai de sa priorité.',
    'بطاقة عولجت بعد الأجل المستهدف لأولويتها.',
    { valeurs: ouiNon }),
  dim('tranche_age', 'attribute', 'Tranche d’âge', 'فئة العمر',
    'Âge du stock ouvert en jours, par tranche.',
    'عمر المخزون المفتوح بالأيام حسب الفئة.',
    {
      valeurs: [
        { id: '0-7', label_fr: '0 à 7 jours', label_ar: '0 إلى 7 أيام' },
        { id: '8-14', label_fr: '8 à 14 jours', label_ar: '8 إلى 14 يوما' },
        { id: '15-30', label_fr: '15 à 30 jours', label_ar: '15 إلى 30 يوما' },
        { id: '>30', label_fr: 'Plus de 30 jours', label_ar: 'أكثر من 30 يوما' },
      ],
    }),
  dim('tranche_delai', 'attribute', 'Tranche de délai', 'فئة المدة',
    'Délai de traitement en jours, par tranche.',
    'مدة المعالجة بالأيام حسب الفئة.',
    {
      valeurs: [
        { id: '0-2', label_fr: '0 à 2 jours', label_ar: '0 إلى يومين' },
        { id: '3-7', label_fr: '3 à 7 jours', label_ar: '3 إلى 7 أيام' },
        { id: '8-14', label_fr: '8 à 14 jours', label_ar: '8 إلى 14 يوما' },
        { id: '15-30', label_fr: '15 à 30 jours', label_ar: '15 إلى 30 يوما' },
        { id: '>30', label_fr: 'Plus de 30 jours', label_ar: 'أكثر من 30 يوما' },
        { id: 'na', label_fr: 'Non traitées', label_ar: 'غير معالجة' },
      ],
    }),

  dim('signalement', 'time', 'Date de signalement', 'تاريخ الإبلاغ',
    'Date de réception de la fiche (base de la cohorte).',
    'تاريخ استلام البطاقة (أساس الدفعة).',
    { granularites: GRANULARITES.map((g) => g.id) }),
  dim('traitement', 'time', 'Date de traitement', 'تاريخ المعالجة',
    'Date de clôture de l’anomalie.',
    'تاريخ إغلاق الاختلال.',
    { granularites: GRANULARITES.map((g) => g.id) }),
  dim('date_verification', 'time', 'Date de vérification', 'تاريخ التحقق',
    'Date de la vérification terrain.',
    'تاريخ التحقق الميداني.',
    { granularites: GRANULARITES.map((g) => g.id) }),
  dim('intervention', 'time', 'Date d’intervention', 'تاريخ التدخل',
    'Date de début d’intervention.',
    'تاريخ بداية التدخل.',
    { granularites: GRANULARITES.map((g) => g.id) }),
  dim('publication', 'time', 'Date de publication', 'تاريخ النشر',
    'Date de publication d’origine sur la plateforme.',
    'تاريخ النشر الأصلي على المنصة.',
    { granularites: GRANULARITES.map((g) => g.id) }),
];

const measure = (id, temporal, labelFr, labelAr, descriptionFr, descriptionAr, format, extra = {}) => ({
  id,
  type: 'mesure',
  dataset: 'anomalies',
  temporal,
  label_fr: labelFr,
  label_ar: labelAr,
  description_fr: descriptionFr,
  description_ar: descriptionAr,
  format,
  ...extra,
});

/** Mesures du jeu `anomalies` — définitions normatives (§ 4.3). */
export const MEASURES = [
  measure('recues', 'cohorte', 'Fiches reçues', 'البطاقات المستلمة',
    'Nombre de fiches dont la date de signalement appartient à la période.',
    'عدد البطاقات التي ينتمي تاريخ إبلاغها إلى الفترة.', 'entier', { additive: true }),
  measure('traitees_periode', 'traitement', 'Traitées dans la période', 'المعالجة خلال الفترة',
    'Fiches dont la date de traitement appartient à la période, quelle que soit la réception.',
    'البطاقات التي ينتمي تاريخ معالجتها إلى الفترة مهما كان تاريخ الاستلام.', 'entier', { additive: true }),
  measure('cohorte_non_traitees', 'cohorte', 'Non traitées (cohorte)', 'غير معالجة (الدفعة)',
    'Fiches reçues dans la période, non traitées à la date de fin.',
    'بطاقات مستلمة في الفترة وغير معالجة في تاريخ النهاية.', 'entier', { additive: true }),
  measure('cohorte_en_cours', 'cohorte', 'En cours (cohorte)', 'قيد المعالجة (الدفعة)',
    'Fiches reçues dans la période, en cours à la date de fin.',
    'بطاقات مستلمة في الفترة وقيد المعالجة في تاريخ النهاية.', 'entier', { additive: true }),
  measure('cohorte_traitees', 'cohorte', 'Traitées (cohorte)', 'معالجة (الدفعة)',
    'Fiches reçues dans la période, traitées à la date de fin.',
    'بطاقات مستلمة في الفترة ومعالجة في تاريخ النهاية.', 'entier', { additive: true }),
  measure('cohorte_pct_non_traitees', 'cohorte', 'Part non traitées', 'نسبة غير المعالجة',
    'Part des non traitées dans la cohorte (plus grand reste).',
    'نسبة غير المعالجة في الدفعة (أكبر باق).', 'pourcentage', { derivee: 'partition', partition: ['cohorte_non_traitees', 'cohorte_en_cours', 'cohorte_traitees'] }),
  measure('cohorte_pct_en_cours', 'cohorte', 'Part en cours', 'نسبة قيد المعالجة',
    'Part des en cours dans la cohorte (plus grand reste).',
    'نسبة قيد المعالجة في الدفعة (أكبر باق).', 'pourcentage', { derivee: 'partition', partition: ['cohorte_non_traitees', 'cohorte_en_cours', 'cohorte_traitees'] }),
  measure('cohorte_pct_traitees', 'cohorte', 'Part traitées', 'نسبة المعالجة',
    'Part des traitées dans la cohorte (plus grand reste).',
    'نسبة المعالجة في الدفعة (أكبر باق).', 'pourcentage', { derivee: 'partition', partition: ['cohorte_non_traitees', 'cohorte_en_cours', 'cohorte_traitees'] }),
  measure('taux_traitement', 'cohorte', 'Taux de traitement', 'معدل المعالجة',
    'Cohorte traitées / fiches reçues.', 'المعالجة في الدفعة / البطاقات المستلمة.', 'pourcentage', { ratio: true }),
  measure('stock_fin', 'stock', 'Stock fin de période', 'المخزون نهاية الفترة',
    'Fiches reçues jusqu’à la fin et non traitées à cette date.',
    'بطاقات مستلمة حتى النهاية وغير معالجة في ذلك التاريخ.', 'entier', { additive: false }),
  measure('stock_debut', 'stock', 'Stock début de période', 'المخزون بداية الفترة',
    'Fiches reçues jusqu’à la veille du début et non traitées à cette date.',
    'بطاقات مستلمة حتى عشية البداية وغير معالجة في ذلك التاريخ.', 'entier', { additive: false }),
  measure('variation_stock', 'stock', 'Variation du stock', 'تغير المخزون',
    'Stock fin moins stock début.', 'المخزون النهاية ناقص المخزون البداية.', 'entier', { derivee: 'difference', from: ['stock_fin', 'stock_debut'] }),
  measure('taux_traitement_cumule', 'stock', 'Taux de traitement cumulé', 'معدل المعالجة التراكمي',
    'Traitées à la date de fin / total reçu jusqu’à cette date.',
    'المعالجة في تاريخ النهاية / مجموع المستلمة حتى ذلك التاريخ.', 'pourcentage', { ratio: true }),
  measure('delai_moyen', 'traitement', 'Délai moyen', 'متوسط المدة',
    'Jours entre signalement et traitement des fiches traitées dans la période.',
    'الأيام بين الإبلاغ والمعالجة للبطاقات المعالجة في الفترة.', 'jours', { incompatibleDimensions: ['statut', 'statut_fin'] }),
  measure('delai_median', 'traitement', 'Délai médian', 'الوسيط',
    'Médiane exacte des délais de traitement de la période.',
    'الوسيط الدقيق لمدد المعالجة في الفترة.', 'jours', { incompatibleDimensions: ['statut', 'statut_fin'] }),
  measure('delai_p90', 'traitement', 'Délai P90', 'المئين 90',
    '90 % des délais de traitement sont inférieurs ou égaux à cette valeur.',
    '90 % من مدد المعالجة أقل أو تساوي هذه القيمة.', 'jours', { incompatibleDimensions: ['statut', 'statut_fin'] }),
  measure('delai_min', 'traitement', 'Délai minimum', 'أدنى مدة',
    'Plus petit délai de traitement de la période.',
    'أصغر مدة معالجة في الفترة.', 'jours', { incompatibleDimensions: ['statut', 'statut_fin'] }),
  measure('delai_max', 'traitement', 'Délai maximum', 'أقصى مدة',
    'Plus grand délai de traitement de la période.',
    'أكبر مدة معالجة في الفترة.', 'jours', { incompatibleDimensions: ['statut', 'statut_fin'] }),
  measure('delai_verification_moyen', 'verification', 'Délai de vérification', 'مدة التحقق',
    'Jours entre signalement et vérification des fiches vérifiées dans la période.',
    'الأيام بين الإبلاغ والتحقق للبطاقات المتحقق منها في الفترة.', 'jours', { deprecated: true }),
  measure('delai_intervention_moyen', 'intervention', 'Délai d’intervention', 'مدة التدخل',
    'Jours entre vérification et intervention.',
    'الأيام بين التحقق والتدخل.', 'jours'),
  measure('taux_sla', 'traitement', 'Taux de respect du SLA', 'معدل احترام الأجل',
    'Part des traitées dans la période dont le délai respecte la cible de leur priorité.',
    'نسبة المعالجة في الفترة التي تحترم مدتها الأجل المستهدف لأولويتها.', 'pourcentage', { ratio: true }),
  measure('nb_hors_sla', 'traitement', 'Hors SLA', 'خارج الأجل',
    'Nombre de traitées dans la période au-delà de la cible de leur priorité.',
    'عدد المعالجة في الفترة التي تجاوزت الأجل المستهدف لأولويتها.', 'entier', { additive: true }),
  measure('age_moyen_stock', 'stock', 'Âge moyen du stock', 'متوسط عمر المخزون',
    'Âge moyen en jours du stock ouvert à la fin de période.',
    'متوسط عمر المخزون المفتوح بالأيام في نهاية الفترة.', 'jours'),
  measure('age_max_stock', 'stock', 'Âge maximum du stock', 'أقصى عمر للمخزون',
    'Âge maximum en jours du stock ouvert à la fin de période.',
    'أقصى عمر للمخزون المفتوح بالأيام في نهاية الفترة.', 'jours'),
  measure('en_retard', 'stock', 'En retard', 'متأخر',
    'Stock ouvert plus ancien que le délai de retard configuré.',
    'مخزون مفتوح أقدم من أجل التأخر المضبوط.', 'entier', { additive: false }),
  measure('urgentes_ouvertes', 'stock', 'Urgentes ouvertes', 'العاجلة المفتوحة',
    'Stock ouvert à la fin avec priorité urgente.',
    'مخزون مفتوح في النهاية بأولوية عاجلة.', 'entier', { additive: false }),
  measure('taux_confirmation', 'verification', 'Taux de confirmation', 'معدل التأكيد',
    'Confirmées / fiches vérifiées dans la période.',
    'المؤكدة / البطاقات المتحقق منها في الفترة.', 'pourcentage', { ratio: true, deprecated: true }),
  measure('taux_infirmation', 'verification', 'Taux d’infirmation', 'معدل النفي',
    'Infirmées / fiches vérifiées dans la période.',
    'المنفية / البطاقات المتحقق منها في الفترة.', 'pourcentage', { ratio: true, deprecated: true }),
  measure('taux_geolocalisation', 'cohorte', 'Taux de géolocalisation', 'معدل التموقع',
    'Part des fiches reçues avec des coordonnées GPS.',
    'نسبة البطاقات المستلمة مع إحداثيات.', 'pourcentage', { ratio: true }),
  measure('taux_gps_confirme', 'cohorte', 'Taux de GPS confirmé', 'معدل تأكيد الإحداثيات',
    'Part des fiches reçues dont les coordonnées sont confirmées sur place.',
    'نسبة البطاقات المستلمة التي تم تأكيد إحداثياتها ميدانيا.', 'pourcentage', { ratio: true }),
  measure('nb_liens_distincts', 'cohorte', 'Liens distincts', 'روابط مختلفة',
    'Nombre de liens normalisés distincts dans la cohorte.',
    'عدد الروابط المطبعية المختلفة في الدفعة.', 'entier', { additive: false }),
  measure('nb_communes_touchees', 'cohorte', 'Communes touchées', 'بلديات معنية',
    'Nombre de communes distinctes dans la cohorte.',
    'عدد البلديات المختلفة في الدفعة.', 'entier', { additive: false }),
  measure('nb_dairas_touchees', 'cohorte', 'Daïras touchées', 'دوائر معنية',
    'Nombre de daïras distinctes dans la cohorte.',
    'عدد الدوائر المختلفة في الدفعة.', 'entier', { additive: false }),
  measure('nb_recurrents', 'cohorte', 'Fiches récurrentes', 'بطاقات متكررة',
    'Fiches liées à une fiche mère dans la cohorte.',
    'بطاقات مرتبطة ببطاقة أم في الدفعة.', 'entier', { additive: true }),
  measure('indice_recurrence', 'cohorte', 'Indice de récurrence', 'مؤشر التكرار',
    'Fiches récurrentes / fiches reçues.',
    'البطاقات المتكررة / البطاقات المستلمة.', 'pourcentage', { ratio: true }),
  measure('pct_du_total', 'derivee', 'Part du total', 'النسبة من المجموع',
    'Valeur de la première mesure additive rapportée au total affiché.',
    'قيمة أول مقياس إضافي منسوبة إلى المجموع المعروض.', 'pourcentage', { derivee: 'part' }),
  measure('rang', 'derivee', 'Rang', 'الترتيب',
    'Rang de la ligne selon la première mesure additive.',
    'ترتيب السطر حسب أول مقياس إضافي.', 'entier', { derivee: 'rang' }),
  measure('pct_cumule', 'derivee', 'Part cumulée', 'النسبة التراكمية',
    'Cumul de la part du total (Pareto).',
    'تراكم النسبة من المجموع (باريتو).', 'pourcentage', { derivee: 'cumul' }),
  // V12 — affectation des agents et photos avant/après.
  measure('non_affectees', 'stock', 'Non affectées', 'غير المؤثرة',
    'Anomalies ouvertes à la fin de la période sans agent affecté.',
    'النقاط السوداء المفتوحة في نهاية الفترة بدون وكيل مكلف.', 'entier', { additive: false }),
  measure('delai_prise_en_charge', 'cohorte', 'Délai de prise en charge', 'مدة التكفل',
    'Jours entre le signalement et l’affectation à un agent, pour les fiches de la cohorte affectées.',
    'الأيام بين الإبلاغ والتكليف بوكيل لبطاقات الدفعة المكلفة.', 'jours', { incompatibleDimensions: ['statut', 'statut_fin'] }),
  measure('charge_agent', 'stock', 'Charge par agent', 'العبء لكل وكيل',
    'Anomalies ouvertes affectées rapportées au nombre d’agents actifs.',
    'النقاط السوداء المفتوحة المكلفة منسوبة إلى عدد الوكلاء النشطين.', 'entier'),
  measure('taux_traitement_par_agent', 'traitement', 'Taux de traitement par agent', 'معدل المعالجة لكل وكيل',
    'Part des fiches traitées dans la période qui sont rattachées à un agent.',
    'نسبة البطاقات المعالجة في الفترة المرتبطة بوكيل.', 'pourcentage', { ratio: true }),
  measure('taux_photo_avant', 'cohorte', 'Taux de photo avant', 'معدل صورة قبل',
    'Part des fiches de la cohorte avec au moins une photo « avant ».',
    'نسبة بطاقات الدفعة التي تتوفر على صورة « قبل » واحدة على الأقل.', 'pourcentage', { ratio: true }),
  measure('taux_photo_apres', 'traitement', 'Taux de photo après', 'معدل صورة بعد',
    'Part des fiches traitées dans la période avec au moins une photo « après ».',
    'نسبة البطاقات المعالجة في الفترة التي تتوفر على صورة « بعد » واحدة على الأقل.', 'pourcentage', { ratio: true }),
];

const filter = (id, valueType, ops, extra = {}) => {
  const dimension = DIMENSIONS.find((d) => d.id === id);
  return {
    id,
    type: 'filtre',
    dataset: 'anomalies',
    label_fr: extra.label_fr || dimension?.label_fr || id,
    label_ar: extra.label_ar || dimension?.label_ar || id,
    description_fr: extra.description_fr || dimension?.description_fr || '',
    description_ar: extra.description_ar || dimension?.description_ar || '',
    valueType,
    ops,
    valeurs: extra.valeurs || dimension?.valeurs,
    ...extra,
  };
};

/** Filtres du contexte (§ 4.4). Tous sont combinés en ET ; les listes en OU. */
export const FILTRES = [
  filter('domaine', 'id', ['in', 'not_in', 'eq', 'is_null']),
  filter('groupe', 'id', ['in', 'not_in', 'eq', 'is_null']),
  filter('type', 'id', ['in', 'not_in', 'eq', 'is_null']),
  filter('daira', 'id', ['in', 'not_in', 'eq', 'is_null']),
  filter('commune', 'id', ['in', 'not_in', 'eq', 'is_null']),
  filter('epic', 'id', ['in', 'not_in', 'eq', 'is_null']),
  filter('agent', 'id', ['in', 'not_in', 'eq', 'is_null']),
  filter('saisi_par', 'id', ['in', 'not_in', 'eq', 'is_null']),
  filter('statut', 'enum', ['in', 'not_in', 'eq'], { valeurs: enumValues(STATUT_LABELS, STATUTS) }),
  filter('verification', 'enum', ['in', 'not_in', 'eq'], { valeurs: enumValues(VERIFICATION_LABELS, VERIFICATIONS) }),
  filter('priorite', 'enum', ['in', 'not_in', 'eq'], { valeurs: enumValues(PRIORITY_LABELS, PRIORITES) }),
  filter('plateforme', 'enum', ['in', 'not_in', 'eq'], { valeurs: enumValues(PLATFORM_LABELS, PLATEFORMES) }),
  filter('contenu_type', 'enum', ['in', 'not_in', 'eq'], { valeurs: enumValues(CONTENU_LABELS, CONTENU_TYPES) }),
  filter('source_saisie', 'enum', ['in', 'not_in', 'eq'], { valeurs: DIMENSIONS.find((d) => d.id === 'source_saisie').valeurs }),
  filter('gps_source', 'enum', ['in', 'not_in', 'eq', 'is_null'], { valeurs: enumValues(GPS_SOURCE_LABELS, GPS_SOURCES) }),
  filter('tranche_age', 'enum', ['in', 'not_in', 'eq'], { valeurs: DIMENSIONS.find((d) => d.id === 'tranche_age').valeurs }),
  filter('tranche_delai', 'enum', ['in', 'not_in', 'eq'], { valeurs: DIMENSIONS.find((d) => d.id === 'tranche_delai').valeurs }),
  filter('gps', 'bool', ['eq']),
  filter('gps_verifiee', 'bool', ['eq']),
  filter('recurrent', 'bool', ['eq']),
  filter('a_pieces_jointes', 'bool', ['eq']),
  filter('en_retard', 'bool', ['eq']),
  filter('hors_sla', 'bool', ['eq']),
  filter('urgentes', 'bool', ['eq'], {
    label_fr: 'Urgentes', label_ar: 'عاجلة',
    description_fr: 'Fiches de priorité urgente.', description_ar: 'بطاقات بأولوية عاجلة.',
  }),
  filter('signalement', 'date', ['between', 'gte', 'lte', 'eq']),
  filter('traitement', 'date', ['between', 'gte', 'lte', 'eq']),
  filter('date_verification', 'date', ['between', 'gte', 'lte', 'eq']),
  filter('intervention', 'date', ['between', 'gte', 'lte', 'eq']),
  filter('publication', 'date', ['between', 'gte', 'lte', 'eq']),
  filter('q', 'text', ['contains'], {
    label_fr: 'Recherche texte', label_ar: 'بحث نصي',
    description_fr: 'Recherche normalisée dans la fiche (arabe/latin).',
    description_ar: 'بحث مطبع في البطاقة (عربي/لاتيني).',
  }),
];

const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item]));

export const CATALOGUE = {
  version: CATALOGUE_VERSION,
  datasets: byId(DATASETS),
  dimensions: byId(DIMENSIONS),
  mesures: byId(MEASURES),
  filtres: byId(FILTRES),
  formats: byId(FORMATS),
  granularites: byId(GRANULARITES),
  ops: byId(OPS),
  formats_ids: FORMAT_IDS,
};

export const DIMENSION_IDS = DIMENSIONS.map((d) => d.id);
export const MEASURE_IDS = MEASURES.map((m) => m.id);
export const FILTER_IDS = FILTRES.map((f) => f.id);
export const GRANULARITE_IDS = GRANULARITES.map((g) => g.id);
export const OP_IDS = OPS.map((o) => o.id);

/** Retrouve une dimension par id, en tolérant le préfixe `t.` du temps. */
export function findDimension(id) {
  if (!id) return null;
  const clean = String(id).replace(/^t\./, '');
  return CATALOGUE.dimensions[clean] || null;
}

/** Mesures dont l’affichage est incompatible avec une dimension. */
export function measureCompatible(measureId, dimensionId) {
  const m = CATALOGUE.mesures[measureId];
  const d = findDimension(dimensionId);
  if (!m || !d) return false;
  return !(m.incompatibleDimensions || []).includes(d.id);
}
