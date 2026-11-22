import { describe, expect, it } from 'vitest';
import { anomalieCreateSchema } from '../src/schemas.js';
import { formPayload, validateForm } from '../src/formValidation.js';

const base = () => ({
  lien_url: 'https://facebook.com/page/posts/1', date_signalement: '2026-11-22',
  domaine_id: 1, type_id: 1, daira_id: 1, commune_id: 1, statut: 'non_traite',
  source_reseau_id: '',
});

describe('V14 — page source dans le formulaire', () => {
  it('transforme une page absente en null au lieu d’un identifiant 0 invalide', () => {
    const payload = formPayload(base());
    expect(payload.source_reseau_id).toBeNull();
    expect(validateForm(base(), null).source_reseau_id).toBeUndefined();
  });

  it('accepte une page sélectionnée et la transmet comme entier', () => {
    const values = { ...base(), source_reseau_id: '12' };
    const payload = formPayload(values);
    expect(payload.source_reseau_id).toBe(12);
    const parsed = anomalieCreateSchema.safeParse(payload);
    expect(parsed.error?.issues?.some((issue) => issue.path[0] === 'source_reseau_id')).toBeFalsy();
  });
});
