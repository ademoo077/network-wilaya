export const STATUT_TRANSITIONS = {
  non_traite: ['en_cours', 'traite'],
  en_cours: ['traite', 'non_traite'],
  traite: [],
};

export const VERIFICATION_TRANSITIONS = {
  a_verifier: ['confirmee', 'infirmee'],
  confirmee: ['infirmee'],
  infirmee: ['a_verifier', 'confirmee'],
};

/*
 * V13 — source unique des exigences de statut.
 * Le service, la validation, le menu Statut et les messages d'erreur lisent
 * exclusivement ces définitions : aucun libellé d'exigence n'est écrit ailleurs.
 */
const EXIGENCE = Object.freeze({
  intervenant: Object.freeze({ code: 'intervenant', champs: ['epic_id', 'intervenant_autre'],
    libelle: { fr: 'intervenant', ar: 'متدخل' }, court: { fr: 'intervenant', ar: 'متدخل' } }),
  date_intervention: Object.freeze({ code: 'date_intervention', champs: ['date_intervention'],
    libelle: { fr: 'date d’intervention', ar: 'تاريخ التدخل' }, court: { fr: 'date', ar: 'تاريخ' } }),
  date_traitement: Object.freeze({ code: 'date_traitement', champs: ['date_traitement'],
    libelle: { fr: 'date de traitement', ar: 'تاريخ المعالجة' }, court: { fr: 'date', ar: 'تاريخ' } }),
  photo_apres: Object.freeze({ code: 'photo_apres', champs: ['sans_photo_motif'],
    libelle: { fr: 'photo après ou motif de dispense', ar: 'صورة بعد أو سبب الاستثناء' },
    court: { fr: 'photo après', ar: 'صورة بعد' },
    alternative: Object.freeze({ code: 'motif_sans_photo', libelle: { fr: 'motif de dispense', ar: 'سبب الاستثناء' } }) }),
});

export const EXIGENCES_STATUT = Object.freeze({
  non_traite: Object.freeze([]),
  en_cours: Object.freeze([EXIGENCE.intervenant]),
  traite: Object.freeze([EXIGENCE.intervenant, EXIGENCE.date_traitement, EXIGENCE.photo_apres]),
});

const LIBELLES_STATUT = Object.freeze({
  non_traite: { fr: 'Non traitée', ar: 'غير معالجة' },
  en_cours: { fr: 'En cours', ar: 'قيد المعالجة' },
  traite: { fr: 'Traitée', ar: 'معالجة' },
});

/** Liste structurée, sans effet de bord, des exigences d'un statut. */
export function exigencesStatut(statut) {
  return EXIGENCES_STATUT[statut] || EXIGENCES_STATUT.non_traite;
}

export function codesExigences(statut) {
  return exigencesStatut(statut).map((exigence) => exigence.code);
}

/** Date posée par le moteur quand le statut avance (invariant SQL, pas un libellé). */
const DATES_IMPLICISES = Object.freeze({ en_cours: 'date_intervention', traite: 'date_traitement' });
export function dateImpliciteStatut(statut) {
  return DATES_IMPLICISES[statut] || null;
}

/** Libellés lisibles dérivés de la source unique (FR/AR). */
export function libelleExigences(statut, lang = 'fr') {
  return exigencesStatut(statut).map((exigence) => {
    const base = exigence.libelle[lang] || exigence.libelle.fr;
    return exigence.alternative ? `${base} (${exigence.alternative.libelle[lang] || exigence.alternative.libelle.fr})` : base;
  }).join(lang === 'ar' ? '، ' : ', ');
}

/** Libellé du menu Statut : « Traitée — intervenant, date et photo après requis ». */
export function libelleStatut(statut, lang = 'fr') {
  const base = LIBELLES_STATUT[statut]?.[lang] || LIBELLES_STATUT[statut]?.fr || statut;
  const codes = codesExigences(statut);
  if (!codes.length) return base;
  const parties = codes.map((code) => {
    const exigence = exigencesStatut(statut).find((item) => item.code === code);
    return exigence?.court?.[lang] || exigence?.court?.fr || code;
  });
  const sep = lang === 'ar' ? '، ' : ', ';
  return lang === 'ar' ? `${base} — ${parties.join(sep)} مطلوبة` : `${base} — ${parties.join(sep)} requis`;
}

/** Statut d'une anomalie à une date D (§ 5.2). */
export function statutAu(anomalie, D) {
  if (!anomalie || !D) return null;
  if (anomalie.date_signalement && anomalie.date_signalement > D) return 'inexistante';
  if (anomalie.date_traitement && anomalie.date_traitement <= D) return 'traite';
  if (anomalie.date_intervention && anomalie.date_intervention <= D) return 'en_cours';
  return 'non_traite';
}

export function transitionStatutPermise(from, to) {
  if (!from) return true;
  if (from === to) return true;
  return (STATUT_TRANSITIONS[from] || []).includes(to);
}

export function transitionVerificationPermise(from, to, statut) {
  if (!from) return true;
  if (from === to) return true;
  if (from === 'confirmee' && to === 'infirmee') return statut === 'non_traite';
  return (VERIFICATION_TRANSITIONS[from] || []).includes(to);
}

export function estRetourArriere(from, to) {
  const rank = { non_traite: 0, en_cours: 1, traite: 2 };
  return from !== to && rank[to] < rank[from];
}

export function anomaliesExclues(anomalie, includeInfirmees = false) {
  if (!anomalie || anomalie.deleted_at) return true;
  if (!includeInfirmees && anomalie.verification === 'infirmee') return true;
  return false;
}
