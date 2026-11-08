export const STATUT_TRANSITIONS = {
  non_traite: ['en_cours', 'traite'],
  en_cours: ['traite', 'non_traite'],
  traite: ['en_cours', 'non_traite'],
};

export const VERIFICATION_TRANSITIONS = {
  a_verifier: ['confirmee', 'infirmee'],
  confirmee: ['infirmee'],
  infirmee: ['a_verifier', 'confirmee'],
};

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
