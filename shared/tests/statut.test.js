import { describe, it, expect } from 'vitest';
import {
  statutAu, transitionStatutPermise, transitionVerificationPermise,
  estRetourArriere, anomaliesExclues,
  exigencesStatut, codesExigences, libelleExigences, libelleStatut,
} from '../src/statut.js';

describe('statutAu', () => {
  const base = { date_signalement: '2026-11-02', date_intervention: null, date_traitement: null };

  it('retourne inexistante avant le signalement', () => {
    expect(statutAu(base, '2026-11-01')).toBe('inexistante');
  });

  it('retourne non_traite, en_cours puis traite', () => {
    expect(statutAu(base, '2026-11-02')).toBe('non_traite');
    expect(statutAu({ ...base, date_intervention: '2026-11-04' }, '2026-11-04')).toBe('en_cours');
    expect(statutAu({ ...base, date_intervention: '2026-11-04', date_traitement: '2026-11-06' }, '2026-11-06')).toBe('traite');
  });
});

describe('transitions', () => {
  it('autorise uniquement les transitions de statut prévues', () => {
    expect(transitionStatutPermise('non_traite', 'en_cours')).toBe(true);
    expect(transitionStatutPermise('non_traite', 'traite')).toBe(true);
    expect(transitionStatutPermise('en_cours', 'non_traite')).toBe(true);
    expect(transitionStatutPermise('traite', 'en_cours')).toBe(false);
    expect(transitionStatutPermise('traite', 'non_traite')).toBe(false);
    expect(transitionStatutPermise('traite', 'traite')).toBe(true);
  });

  it('interdit confirmee → infirmee si un traitement existe', () => {
    expect(transitionVerificationPermise('confirmee', 'infirmee', 'non_traite')).toBe(true);
    expect(transitionVerificationPermise('confirmee', 'infirmee', 'en_cours')).toBe(false);
    expect(transitionVerificationPermise('infirmee', 'a_verifier')).toBe(true);
  });

  it('détecte les retours arrière', () => {
    expect(estRetourArriere('traite', 'en_cours')).toBe(true);
    expect(estRetourArriere('en_cours', 'traite')).toBe(false);
    expect(estRetourArriere('traite', 'traite')).toBe(false);
  });

  it('exclut supprimées et infirmées', () => {
    expect(anomaliesExclues({ verification: 'confirmee' })).toBe(false);
    expect(anomaliesExclues({ verification: 'infirmee' })).toBe(true);
    expect(anomaliesExclues({ verification: 'infirmee' }, true)).toBe(false);
    expect(anomaliesExclues({ deleted_at: '2026-11-08' }, true)).toBe(true);
  });
});

describe('V13 — source unique des exigences de statut', () => {
  it('expose une liste structurée par statut', () => {
    expect(exigencesStatut('non_traite')).toEqual([]);
    expect(codesExigences('en_cours')).toEqual(['intervenant']);
    expect(codesExigences('traite')).toEqual(['intervenant', 'date_traitement', 'photo_apres']);
    expect(exigencesStatut('inconnu')).toEqual([]);
  });

  it('dérive les libellés sans jamais mentionner la vérification', () => {
    expect(libelleStatut('non_traite', 'fr')).toBe('Non traitée');
    expect(libelleStatut('en_cours', 'fr')).toBe('En cours — intervenant requis');
    expect(libelleStatut('traite', 'fr')).toBe('Traitée — intervenant, date, photo après requis');
    for (const statut of ['non_traite', 'en_cours', 'traite']) {
      for (const lang of ['fr', 'ar']) {
        expect(libelleStatut(statut, lang)).not.toMatch(/vérif|verif|التحقق/i);
        expect(libelleExigences(statut, lang)).not.toMatch(/vérif|verif|التحقق/i);
      }
    }
  });

  it('conservant l’alternative photo après / motif dans la source unique', () => {
    const photo = exigencesStatut('traite').find((item) => item.code === 'photo_apres');
    expect(photo.champs).toEqual(['sans_photo_motif']);
    expect(photo.alternative.code).toBe('motif_sans_photo');
  });
});
