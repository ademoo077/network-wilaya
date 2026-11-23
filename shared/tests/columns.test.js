import { describe, expect, it } from 'vitest';
import {
  COLONNES_PRESETS, ajusterColonnesImpression, colonnesAffichees, colonnesDuBloc, validerColonnesBloc,
} from '../src/index.js';

const bloc = {
  id: 't',
  type: 'tableau',
  requete: {
    dataset: 'anomalies',
    mesures: [{ id: 'recues' }, { id: 'taux_traitement' }],
    dimensions: [{ champ: 'commune' }, { champ: 'agent' }],
    filtres: [],
    periode: { mode: 'herite' },
  },
};

describe('colonnes V11', () => {
  it('expose toutes les dimensions et mesures sans configuration', () => {
    const colonnes = colonnesDuBloc(bloc);
    expect(colonnes.map((c) => c.id)).toEqual(['d:commune', 'd:agent', 'm:recues', 'm:taux_traitement']);
  });

  it('masque les champs sensibles pour le rôle lecteur', () => {
    const colonnes = colonnesDuBloc(bloc, { role: 'lecteur' });
    expect(colonnes.map((c) => c.champ)).not.toContain('agent');
  });

  it('respecte la visibilité écran et impression', () => {
    const b = {
      ...bloc,
      options: { colonnes: [
        { source: 'dimension', champ: 'commune', priorite: 'P1', visible_ecran: true, visible_impression: true },
        { source: 'dimension', champ: 'agent', priorite: 'P1', visible_ecran: false, visible_impression: true },
      ] },
    };
    expect(colonnesAffichees(b, null, { role: 'admin' }).map((c) => c.champ)).toEqual(['commune']);
    expect(colonnesAffichees(b, null, { role: 'admin', impression: true }).map((c) => c.champ)).toEqual(['commune', 'agent']);
  });

  it('réduit la densité en masquant P3 puis P2', () => {
    const colonnes = ['a', 'b', 'c', 'd'].map((id, index) => ({ id, priorite: index === 0 ? 'P1' : index === 1 ? 'P2' : 'P3' }));
    expect(ajusterColonnesImpression(colonnes, { maxColonnes: 2 }).map((c) => c.id)).toEqual(['a', 'b']);
    expect(ajusterColonnesImpression(colonnes, { maxColonnes: 1 }).map((c) => c.id)).toEqual(['a']);
  });

  it('V15 : les dimensions précèdent toujours les mesures', () => {
    const ancien = {
      ...bloc,
      options: { colonnes: [
        { source: 'mesure', champ: 'recues', visible_ecran: true, visible_impression: true },
        { source: 'dimension', champ: 'commune', visible_ecran: true, visible_impression: true },
      ] },
    };
    expect(colonnesAffichees(ancien, null).map((c) => c.id)).toEqual(['d:commune', 'm:recues']);
  });

  it('V15 : garde la dimension quand le résultat n’expose que son identifiant', () => {
    const resultat = { colonnes: { dimensions: [{ id: 'commune' }], mesures: [{ id: 'recues' }] } };
    expect(colonnesAffichees(bloc, resultat).map((c) => c.id)).toEqual(['d:commune', 'm:recues']);
  });

  it('applique les préréglages de colonnes', () => {
    expect(COLONNES_PRESETS.compact).toBeTruthy();
    expect(colonnesDuBloc({ ...bloc, options: { colonnes: [] } })).toHaveLength(4);
  });

  it('refuse les doublons, priorités inconnues et colonnes sensibles pour lecteur', () => {
    expect(() => validerColonnesBloc({
      ...bloc,
      options: { colonnes: [
        { source: 'dimension', champ: 'commune' },
        { source: 'dimension', champ: 'commune' },
      ] },
    })).toThrow(/deux fois/);
    expect(() => validerColonnesBloc({
      ...bloc,
      options: { colonnes: [{ source: 'dimension', champ: 'commune', priorite: 'P9' }] },
    })).toThrow(/Priorité/);
    expect(() => validerColonnesBloc({
      ...bloc,
      options: { colonnes: [{ source: 'dimension', champ: 'agent' }] },
    }, { role: 'lecteur' })).toThrow(/sensible/);
  });
});