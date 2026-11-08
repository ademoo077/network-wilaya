import {
  isDateString, isFuture, todayAlgiers, transitionStatutPermise,
  transitionVerificationPermise, estRetourArriere, STATUTS, VERIFICATIONS,
} from '@anm/shared';
import { business } from '../utils/errors.js';

const fail = (code, message, field) => business(message, code, field ? { [field]: message } : undefined);
const clean = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

/**
 * Source unique de validation de l'état final d'une anomalie.
 * Utilisée à la création, à la modification et par les transitions.
 */
export function validerEtat(state, options = {}) {
  const today = options.today || todayAlgiers();
  const previous = options.previous || null;
  const motif = clean(options.motif);
  const exiger = options.exigerVerification !== false;

  const out = {
    ...state,
    verification: state.verification || 'a_verifier',
    statut: state.statut || 'non_traite',
    epic_id: state.epic_id || null,
    agent_id: state.agent_id || null,
    intervenant_autre: clean(state.intervenant_autre),
    date_publication: state.date_publication || null,
    date_signalement: state.date_signalement || today,
    date_verification: state.date_verification || null,
    date_intervention: state.date_intervention || null,
    date_traitement: state.date_traitement || null,
  };

  if (!STATUTS.includes(out.statut)) throw fail('STATUT_INVALIDE', 'Statut inconnu', 'statut');
  if (!VERIFICATIONS.includes(out.verification)) throw fail('VERIFICATION_INVALIDE', 'Vérification inconnue', 'verification');

  if (out.verification === 'infirmee') out.statut = 'non_traite';

  if (previous) {
    if (!transitionStatutPermise(previous.statut, out.statut)) {
      throw fail('TRANSITION_INTERDITE', `Transition ${previous.statut} → ${out.statut} non permise`, 'statut');
    }
    if (!transitionVerificationPermise(previous.verification, out.verification, previous.statut)) {
      throw fail('TRANSITION_INTERDITE', 'Cette transition de vérification n’est pas permise', 'verification');
    }
  }

  for (const field of ['date_publication', 'date_signalement', 'date_verification', 'date_intervention', 'date_traitement']) {
    if (out[field] !== null && !isDateString(out[field])) {
      throw fail('DATE_INVALIDE', 'Date invalide (AAAA-MM-JJ attendu)', field);
    }
    if (out[field] && isFuture(out[field], today)) {
      throw fail('DATE_FUTURE', 'Une date future n’est pas permise', field);
    }
  }

  if (out.verification === 'infirmee') {
    if (state.statut && state.statut !== 'non_traite') {
      throw fail('STATUT_INFIRMEE', 'Une anomalie infirmée reste « non traitée »', 'statut');
    }
    const verificationChanged = !previous || previous.verification !== out.verification;
    if (verificationChanged) {
      if (!out.agent_id) throw fail('AGENT_REQUIS', 'Un agent est obligatoire pour infirmer', 'agent_id');
      if (!motif) throw fail('MOTIF_REQUIS', 'Un motif est obligatoire pour infirmer une anomalie', 'motif');
    }
    out.date_verification = out.date_verification || today;
    out.epic_id = null;
    out.intervenant_autre = null;
  } else if (out.verification === 'confirmee') {
    if (previous && previous.verification === 'infirmee' && !motif) {
      throw fail('MOTIF_REQUIS', 'Un motif est obligatoire pour revenir sur une infirmation', 'motif');
    }
    if (!out.agent_id) throw fail('AGENT_REQUIS', 'Un agent est obligatoire pour confirmer', 'agent_id');
    out.date_verification = out.date_verification || today;
  } else {
    if (previous && previous.verification === 'infirmee' && !motif) {
      throw fail('MOTIF_REQUIS', 'Un motif est obligatoire pour revenir sur une infirmation', 'motif');
    }
    out.date_verification = null;
  }

  if (previous && estRetourArriere(previous.statut, out.statut) && !motif) {
    throw fail('MOTIF_REQUIS', 'Un motif est obligatoire pour tout retour en arrière', 'motif');
  }

  if (out.statut === 'non_traite') {
    out.date_intervention = null;
    out.date_traitement = null;
  } else {
    if (exiger && out.verification !== 'confirmee') {
      throw fail('VERIFICATION_REQUISE', 'Confirmez d’abord la vérification de l’anomalie', 'statut');
    }
    if (!out.epic_id && !out.intervenant_autre) {
      throw fail('INTERVENANT_REQUIS', 'Indiquez l’EPIC ou un autre intervenant', 'epic_id');
    }
    if (out.statut === 'en_cours') {
      out.date_intervention = out.date_intervention || today;
      out.date_traitement = null;
    } else {
      out.date_traitement = out.date_traitement || today;
      out.date_intervention = out.date_intervention || out.date_traitement;
    }
  }

  if (out.date_publication && out.date_publication > out.date_signalement) {
    throw fail('ORDRE_DATES', 'La date de publication doit précéder le signalement', 'date_publication');
  }
  if (out.date_intervention && out.date_intervention < out.date_signalement) {
    throw fail('ORDRE_DATES', 'L’intervention ne peut précéder le signalement', 'date_intervention');
  }
  if (out.date_intervention && out.date_traitement && out.date_traitement < out.date_intervention) {
    throw fail('ORDRE_DATES', 'Le traitement ne peut précéder l’intervention', 'date_traitement');
  }
  return out;
}
