import { describe, it, expect } from 'vitest';
import {
  validerDefinition, validerRequete,
} from '../src/syntheseSchemas.js';

const base = {
  dataset: 'anomalies',
  mesures: [{ id: 'recues' }],
  dimensions: [],
  filtres: [],
  periode: { mode: 'plage', debut: '2026-11-09', fin: '2026-11-15' },
};

const erreur = (spec, options) => {
  try {
    validerRequete(spec, options);
    return null;
  } catch (error) {
    return error;
  }
};

describe('schémas V8 — requête', () => {
  it('accepte une requête minimale et la renvoie normalisée', () => {
    const spec = validerRequete(base);
    expect(spec.mesures).toEqual([{ id: 'recues' }]);
    expect(spec.dimensions).toEqual([]);
    expect(spec.periode).toEqual(base.periode);
  });

  it('accepte le préfixe temporel t. et exige une granularité', () => {
    const ok = validerRequete({
      ...base,
      dimensions: [{ champ: 't.signalement', granularite: 'semaine' }],
    });
    expect(ok.dimensions[0].champ).toBe('signalement');
    expect(ok.dimensions[0].granularite).toBe('semaine');
    expect(erreur({ ...base, dimensions: [{ champ: 'signalement' }] }).message).toMatch(/Granularité requise/);
    expect(erreur({ ...base, dimensions: [{ champ: 'domaine', granularite: 'jour' }] }).message).toMatch(/Granularité interdite/);
  });

  it('refuse toute clé inconnue (pas de SQL libre)', () => {
    const error = erreur({ ...base, sql: 'SELECT * FROM anomalies' });
    expect(error.code).toBe('SYNTHESE_REQUETE_INVALIDE');
    expect(error.message).toMatch(/Unrecognized key|unrecognized/i);
  });

  it('refuse un identifiant de mesure inconnu', () => {
    expect(erreur({ ...base, mesures: [{ id: 'recues OR 1=1' }] }).message).toMatch(/Invalid enum value|invalide/i);
  });

  it('limite à quatre mesures et refuse les doublons', () => {
    const mesures = ['recues', 'traitees_periode', 'en_retard', 'urgentes_ouvertes'].map((id) => ({ id }));
    expect(erreur({ ...base, mesures: [...mesures, { id: 'taux_sla' }] })).toBeTruthy();
    expect(erreur({ ...base, mesures: [{ id: 'recues' }, { id: 'recues' }] }).message).toMatch(/présente deux fois/);
    expect(erreur({ ...base, mesures: [{ id: 'recues', alias: 'x' }, { id: 'en_retard', alias: 'x' }] }).message).toMatch(/Alias/);
  });

  it('refuse une dimension en double et une incompatibilité mesure × dimension', () => {
    expect(erreur({
      ...base,
      dimensions: [{ champ: 'domaine' }, { champ: 'domaine' }],
    }).message).toMatch(/présente deux fois/);
    expect(erreur({
      ...base,
      mesures: [{ id: 'delai_moyen' }],
      dimensions: [{ champ: 'statut' }],
    }).message).toMatch(/compatible/);
  });

  it('applique les bornes de limite et de tri', () => {
    expect(erreur({ ...base, limite: 0 })).toBeTruthy();
    expect(erreur({ ...base, limite: 5001 })).toBeTruthy();
    expect(validerRequete({ ...base, limite: null }).limite).toBeNull();
    expect(erreur({ ...base, tri: [{ champ: 'recues', dir: 'up' }] })).toBeTruthy();
    expect(erreur({ ...base, tri: [{ champ: 'inconnue', dir: 'asc' }] }).message).toMatch(/absent/);
  });
});

describe('schémas V8 — filtres', () => {
  it('accepte les opérateurs autorisés par type', () => {
    expect(validerRequete({
      ...base,
      filtres: [
        { champ: 'domaine', op: 'in', valeur: [1, 2] },
        { champ: 'q', op: 'contains', valeur: 'travaux' },
        { champ: 'signalement', op: 'between', valeur: ['2026-11-01', '2026-11-15'] },
        { champ: 'gps', op: 'eq', valeur: true },
        { champ: 'epic', op: 'is_null', valeur: true },
      ],
    }).filtres).toHaveLength(5);
  });

  it('refuse un opérateur hors liste blanche', () => {
    expect(erreur({
      ...base,
      filtres: [{ champ: 'domaine', op: 'contains', valeur: 'x' }],
    }).message).toMatch(/Opérateur/);
  });

  it('refuse une liste vide, un between incomplet et un booléen textuel', () => {
    expect(erreur({ ...base, filtres: [{ champ: 'domaine', op: 'in', valeur: [] }] }).message).toMatch(/liste/);
    expect(erreur({ ...base, filtres: [{ champ: 'signalement', op: 'between', valeur: ['2026-11-01'] }] }).message).toMatch(/deux bornes/);
    expect(erreur({ ...base, filtres: [{ champ: 'gps', op: 'eq', valeur: 'oui' }] }).message).toMatch(/booléen/);
    expect(erreur({ ...base, filtres: [{ champ: 'epic', op: 'is_null', valeur: 1 }] }).message).toMatch(/booléenne/);
  });

  it('refuse une date invalide et un texte trop long', () => {
    expect(erreur({ ...base, filtres: [{ champ: 'signalement', op: 'gte', valeur: '2026-02-30' }] }).message).toMatch(/date/);
    expect(erreur({ ...base, filtres: [{ champ: 'q', op: 'contains', valeur: 'x'.repeat(201) }] }).message).toMatch(/200/);
  });
});

describe('schémas V8 — période, comparaison et permissions', () => {
  it('exige les dates de la comparaison libre', () => {
    expect(erreur({ ...base, comparaison: 'periode_libre' }).message).toMatch(/comparaison libre/);
    expect(erreur({ ...base, comparaison: 'periode_libre', comparaison_debut: '2026-10-01' }).message).toMatch(/comparaison libre/);
    expect(erreur({
      ...base,
      comparaison: 'periode_libre',
      comparaison_debut: '2026-10-01',
      comparaison_fin: '2026-10-31',
    })).toBeNull();
  });

  it('valide la période glissante et la période héritée', () => {
    expect(erreur({ ...base, periode: { mode: 'glissant', jours: 0 } })).toBeTruthy();
    expect(erreur({ ...base, periode: { mode: 'glissant', jours: 3661 } })).toBeTruthy();
    expect(validerRequete({ ...base, periode: { mode: 'glissant', jours: 30 } }).periode.jours).toBe(30);
    expect(validerRequete({ ...base, periode: { mode: 'herite' } }).periode.mode).toBe('herite');
    expect(erreur({ ...base, periode: { mode: 'annee' } })).toBeTruthy();
  });

  it('réserve les fiches supprimées à l’administration', () => {
    const spec = { ...base, inclure_supprimees: true };
    const error = erreur(spec);
    expect(error.code).toBe('SYNTHESE_PERMISSION');
    expect(validerRequete(spec, { allowDeleted: true }).inclure_supprimees).toBe(true);
  });
});

describe('schémas V8 — définition de modèle', () => {
  const bloc = (id) => ({ id, type: 'tableau', requete: base });

  it('accepte un modèle minimal', () => {
    const definition = validerDefinition({
      schema_version: 1,
      sections: [{ id: 'section-1', colonnes: [[bloc('bloc-1')]] }],
    });
    expect(definition.sections).toHaveLength(1);
  });

  it('refuse un schéma inconnu, un bloc invalide et plus de 60 blocs', () => {
    expect(() => validerDefinition({ schema_version: 2, sections: [] })).toThrow();
    expect(() => validerDefinition({
      schema_version: 1,
      sections: [{ id: 'x', colonnes: [[{ ...bloc('b1'), type: 'inconnu' }]] }],
    })).toThrow();
    const colonnes = Array.from({ length: 6 }, (_, column) => Array.from(
      { length: 11 },
      (_, index) => bloc(`bloc-${column}-${index}`),
    ));
    const error = (() => {
      try { validerDefinition({ schema_version: 1, sections: [{ id: 'x', colonnes }] }); return null; } catch (caught) { return caught; }
    })();
    expect(error.code).toBe('SYNTHESE_DEFINITION_INVALIDE');
    expect(error.message).toMatch(/60 blocs/);
  });
});
