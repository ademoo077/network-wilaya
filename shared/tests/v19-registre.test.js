import { describe, it, expect } from 'vitest';
import { BLOCS_SANS_REQUETE, validerDefinition } from '../src/syntheseSchemas.js';

describe('V19 — bloc registre', () => {
  it('accepte les réglages d’impression enregistrés dans meta.print', () => {
    expect(() => validerDefinition({
      schema_version: 1,
      sections: [{ id: 'vide', colonnes: [[]] }],
      meta: { gabarit: true, print: { format: 'a5', statut: 'valide', sources: [] } },
    })).not.toThrow();
  });

  it('est un bloc sans requête et accepte des lignes canoniques', () => {
    expect(BLOCS_SANS_REQUETE).toContain('registre');
    const definition = {
      schema_version: 1,
      sections: [{
        id: 'gestionnaire',
        colonnes: [[{
          id: 'registre-ordres',
          type: 'registre',
          titre: 'Gestionnaire des ordres',
          options: {
            lignes: [{
              operation: 'Ordre', entite: 'Cabinet', option: 'Suivi',
              resultat: 'À renseigner', quirons: '—', localisation: 'Alger', notes: '',
            }],
          },
        }]],
      }],
    };
    expect(() => validerDefinition(definition)).not.toThrow();
  });
});
