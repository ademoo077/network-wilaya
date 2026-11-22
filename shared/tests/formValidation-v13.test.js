import { describe, it, expect } from 'vitest';
import { validateForm, formPayload } from '../src/formValidation.js';

const base = () => ({
  lien_url: 'https://facebook.com/page/posts/1', date_signalement: '2026-11-19',
  domaine_id: 1, type_id: 1, daira_id: 1, commune_id: 1, statut: 'traite',
  date_traitement: '2026-11-19', epic_id: 2, intervenant_autre: '', motif: '',
});

describe('V13 — validation dérivée des exigences de statut', () => {
  it('signale les exigences « traitée » sous les champs', () => {
    const values = { ...base(), epic_id: '', date_traitement: '' };
    const errors = validateForm(values, null);
    expect(errors.epic_id).toBe('form.requirement');
    expect(errors.date_traitement).toBe('form.requirement');
  });

  it('exige un motif pour une affectation manuelle', () => {
    const errors = validateForm({ ...base(), agent_id: 7, agent_source: 'manuel', agent_motif: '' }, null);
    expect(errors.agent_motif).toBe('validation.required');
    expect(validateForm({ ...base(), agent_id: 7, agent_source: 'manuel', agent_motif: 'Demande du service' }, null).agent_motif).toBeUndefined();
  });

  it('transporte le motif d’affectation dans le payload', () => {
    expect(formPayload({ agent_id: 7, agent_source: 'manuel', agent_motif: 'Demande du service', gps_text: '' })).toMatchObject({
      agent_id: 7, agent_source: 'manuel', agent_motif: 'Demande du service',
    });
  });
});
