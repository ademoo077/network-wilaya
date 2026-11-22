/**
 * V13 — formateur d'historique lisible (source unique, FR/AR).
 * Convertit les événements bruts (codes techniques, dates ISO) en libellés
 * affichables. Aucune valeur technique ne doit fuir vers l'interface.
 */

const CHAMPS = Object.freeze({
  creation: { fr: 'Création', ar: 'الإنشاء', type: 'creation' },
  suppression: { fr: 'Mise en corbeille', ar: 'نقل إلى سلة المهملات', type: 'statut' },
  restauration: { fr: 'Restauration', ar: 'الاستعادة', type: 'statut' },
  statut: { fr: 'Statut', ar: 'الحالة', type: 'statut' },
  verification: { fr: 'Classement', ar: 'التصنيف', type: 'statut' },
  priorite: { fr: 'Priorité', ar: 'الأولوية', type: 'statut' },
  plateforme: { fr: 'Plateforme', ar: 'المنصة', type: 'source' },
  lien_url: { fr: 'Lien source', ar: 'رابط المصدر', type: 'source' },
  date_signalement: { fr: 'Date de signalement', ar: 'تاريخ الإبلاغ', type: 'date' },
  date_publication: { fr: 'Date de publication', ar: 'تاريخ النشر', type: 'date' },
  date_intervention: { fr: 'Date d’intervention', ar: 'تاريخ التدخل', type: 'date' },
  date_traitement: { fr: 'Date de traitement', ar: 'تاريخ المعالجة', type: 'date' },
  date_verification: { fr: 'Date de classement', ar: 'تاريخ التصنيف', type: 'date' },
  domaine_id: { fr: 'Catégorie', ar: 'الفئة', type: 'details' },
  type_id: { fr: 'Type', ar: 'النوع', type: 'details' },
  daira_id: { fr: 'Daïra', ar: 'الدائرة', type: 'localisation' },
  commune_id: { fr: 'Commune', ar: 'البلدية', type: 'localisation' },
  adresse_texte: { fr: 'Adresse', ar: 'العنوان', type: 'localisation' },
  lieu_dit: { fr: 'Lieu-dit', ar: 'المكان', type: 'localisation' },
  gps: { fr: 'Position GPS', ar: 'الموقع الجغرافي', type: 'localisation' },
  gps_source: { fr: 'Origine du GPS', ar: 'مصدر الموقع', type: 'localisation' },
  agent_id: { fr: 'Agent', ar: 'العون', type: 'agent' },
  epic_id: { fr: 'Intervenant', ar: 'المتدخل', type: 'agent' },
  intervenant_autre: { fr: 'Autre intervenant', ar: 'متدخل آخر', type: 'agent' },
  priorite_changee: { fr: 'Priorité', ar: 'الأولوية', type: 'statut' },
  observations: { fr: 'Observations', ar: 'ملاحظات', type: 'details' },
  motif: { fr: 'Motif', ar: 'السبب', type: 'details' },
  photo: { fr: 'Photo', ar: 'صورة', type: 'photo' },
});

const VALEURS = Object.freeze({
  statut: Object.freeze({
    non_traite: { fr: 'Non traitée', ar: 'غير معالجة' },
    en_cours: { fr: 'En cours', ar: 'قيد المعالجة' },
    traite: { fr: 'Traitée', ar: 'معالجة' },
  }),
  verification: Object.freeze({
    a_verifier: { fr: 'À classer', ar: 'للتصنيف' },
    confirmee: { fr: 'Confirmée', ar: 'مؤكدة' },
    infirmee: { fr: 'Sans suite', ar: 'بدون متابعة' },
  }),
  priorite: Object.freeze({
    normale: { fr: 'Normale', ar: 'عادية' },
    haute: { fr: 'Haute', ar: 'عالية' },
    urgente: { fr: 'Urgente', ar: 'عاجلة' },
  }),
});

const DATE_CHAMPS = new Set([
  'date_signalement', 'date_publication', 'date_intervention',
  'date_traitement', 'date_verification',
]);

export const HISTORIQUE_TYPES = Object.freeze(['creation', 'statut', 'date', 'source', 'localisation', 'agent', 'details', 'photo', 'priorite']);

export const HISTORIQUE_TYPE_LABELS = Object.freeze({
  creation: { fr: 'Création', ar: 'الإنشاء' },
  statut: { fr: 'Statut', ar: 'الحالة' },
  date: { fr: 'Dates', ar: 'التواريخ' },
  source: { fr: 'Source', ar: 'المصدر' },
  localisation: { fr: 'Localisation', ar: 'الموقع' },
  agent: { fr: 'Agent et intervenant', ar: 'العون والمتدخل' },
  details: { fr: 'Détails', ar: 'التفاصيل' },
  photo: { fr: 'Photos', ar: 'الصور' },
  priorite: { fr: 'Priorité', ar: 'الأولوية' },
});

/** Temps écoulé lisible, sans valeur technique (pure, testable). */
export function tempsRelatif(at, maintenant = Date.now(), lang = 'fr') {
  if (typeof at !== 'string') return '';
  const instant = Date.parse(at);
  if (Number.isNaN(instant)) return '';
  const minutes = Math.max(0, Math.floor((maintenant - instant) / 60000));
  if (minutes < 1) return lang === 'ar' ? 'الآن' : 'à l’instant';
  if (minutes < 60) return lang === 'ar' ? (minutes === 1 ? 'منذ دقيقة' : `منذ ${minutes} دقائق`) : `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return lang === 'ar' ? (heures === 1 ? 'منذ ساعة' : `منذ ${heures} ساعات`) : `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  return lang === 'ar' ? (jours === 1 ? 'منذ يوم' : `منذ ${jours} أيام`) : `il y a ${jours} j`;
}

/** Date ISO `YYYY-MM-DD...` → `JJ/MM/AAAA`. */
export function dateLisible(value, lang = 'fr') {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, annee, mois, jour] = match;
  return lang === 'ar' ? `${jour}/${mois}/${annee}` : `${jour}/${mois}/${annee}`;
}

/** Transforme une valeur brute en libellé. `t` est la fonction i18n (optionnelle). */
export function valeurLisible(champ, valeur, lang = 'fr', t = null) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  const texte = String(valeur);
  const table = VALEURS[champ];
  if (table && table[texte]) return table[texte][lang] || table[texte].fr;

  if (DATE_CHAMPS.has(champ)) {
    const date = dateLisible(texte, lang);
    if (date) return date;
  }

  // Un identifiant numérique seul n'a pas de sens pour un lecteur.
  if (/^\d+$/.test(texte)) return null;
  if (texte.startsWith('data:image/')) return t ? t('photo.photo') : (lang === 'ar' ? 'صورة' : 'Photo');
  return texte;
}

/** Découvre le type d'un champ pour le choix de l'icône. */
export function typeEvenement(champ) {
  return CHAMPS[champ]?.type || 'details';
}

/**
 * Formate une entrée d'historique en `{ titre, avant, apres, motif, type, at }`.
 * Les valeurs techniques non traduisibles sont masquées.
 */
export function formaterEntree(entry, lang = 'fr', t = null) {
  const meta = CHAMPS[entry.champ] || {
    fr: entry.champ, ar: entry.champ, type: 'details',
  };
  return {
    titre: meta[lang] || meta.fr,
    avant: valeurLisible(entry.champ, entry.ancienne_valeur, lang, t),
    apres: valeurLisible(entry.champ, entry.nouvelle_valeur, lang, t),
    motif: typeof entry.motif === 'string' && entry.motif.trim() ? entry.motif.trim() : null,
    type: meta.type,
    at: entry.at,
    auteur: entry.user_nom || entry.user_username || null,
  };
}

/** Regroupe les entrées par minute et auteur pour un historique compact. */
export function grouperHistorique(entries, lang = 'fr', t = null) {
  const groupes = [];
  for (const entry of entries || []) {
    const minute = typeof entry.at === 'string' ? entry.at.slice(0, 16) : '';
    const auteur = entry.user_nom || entry.user_username || '';
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.minute === minute && dernier.auteur === auteur) {
      dernier.evenements.push(formaterEntree(entry, lang, t));
    } else {
      groupes.push({ minute, auteur, at: entry.at, evenements: [formaterEntree(entry, lang, t)] });
    }
  }
  return groupes;
}
