import { describe, expect, it } from 'vitest';
import {
  CATALOGUE, KPI_MAX_ITEMS, KPI_PRESETS, creerKpisPreset, kpisDuBloc,
  requetesDuBloc, validerKpisBloc,
} from '../src/index.js';

describe('bloc KPI V11', () => {
  it('convertit un ancien bloc multi-mesures sans changer ses mesures', () => {
    const bloc = {
      id: 'kpi', type: 'kpi',
      requete: { dataset: 'anomalies', mesures: [{ id: 'recues' }, { id: 'taux_traitement' }], dimensions: [], filtres: [], periode: { mode: 'herite' } },
    };
    expect(kpisDuBloc(bloc).map((item) => item.mesure)).toEqual(['recues', 'taux_traitement']);
    expect(requetesDuBloc(bloc)).toHaveLength(1);
  });

  it('orchestre chaque KPI configuré par le même schéma de requête', () => {
    const bloc = {
      id: 'pilotage', type: 'kpi',
      requete: { dataset: 'anomalies', mesures: [{ id: 'recues' }], dimensions: [], filtres: [], periode: { mode: 'herite' } },
      options: { kpis: [
        { id: 'flux', mesure: 'recues', comparaison: 'periode_precedente' },
        { id: 'delai', mesure: 'delai_median', periode: { mode: 'glissant', jours: 30 }, sens_favorable: 'baisse' },
      ] },
    };
    const specs = requetesDuBloc(bloc);
    expect(specs).toHaveLength(2);
    expect(specs[0]).toMatchObject({ key: 'flux', requete: { dataset: 'anomalies', mesures: [{ id: 'recues' }], comparaison: 'periode_precedente' } });
    expect(specs[1]).toMatchObject({ key: 'delai', requete: { mesures: [{ id: 'delai_median' }], periode: { mode: 'glissant', jours: 30 } } });
  });

  it('fournit cinq préréglages valides', () => {
    expect(Object.keys(KPI_PRESETS)).toEqual(expect.arrayContaining(['essentiel', 'pilotage', 'delais', 'qualite', 'reseaux']));
    for (const key of Object.keys(KPI_PRESETS)) {
      const items = creerKpisPreset(key);
      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(KPI_MAX_ITEMS);
      expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
      for (const item of items) expect(CATALOGUE.mesures[item.mesure], `${key}:${item.mesure}`).toBeTruthy();
    }
    expect(creerKpisPreset('pilotage')).toHaveLength(12);
  });

  it('refuse plus de 24 KPI, les ids dupliqués et les mesures inconnues', () => {
    const base = { id: 'kpi', type: 'kpi', requete: { mesures: [{ id: 'recues' }] } };
    expect(() => validerKpisBloc({ ...base, options: { kpis: Array.from({ length: 25 }, (_, index) => ({ id: `k-${index}`, mesure: 'recues' })) } })).toThrow(/24/);
    expect(() => validerKpisBloc({ ...base, options: { kpis: [{ id: 'a', mesure: 'recues' }, { id: 'a', mesure: 'stock_fin' }] } })).toThrow(/deux fois/);
    expect(() => validerKpisBloc({ ...base, options: { kpis: [{ id: 'a', mesure: 'inconnue' }] } })).toThrow(/inconnue/);
  });
});
