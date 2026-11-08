import { describe, it, expect } from 'vitest';
import {
  statutAu, transitionStatutPermise, transitionVerificationPermise,
  estRetourArriere, anomaliesExclues,
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
    expect(transitionStatutPermise('traite', 'en_cours')).toBe(true);
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
