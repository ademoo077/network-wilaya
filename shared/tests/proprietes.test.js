import { describe, it, expect } from 'vitest';
import { BLOC_TYPES } from '../src/syntheseSchemas.js';
import {
  proprietesPourBloc, getByPath, setByPath, patchByPath, normaliserCouleur, contrasteRatio,
  texteEditableProps, couleurProps, PALETTES,
} from '../src/proprietes.js';

describe('registre proprietes V17', () => {
  it('retourne des propriétés texte et couleur pour chaque type de bloc', () => {
    for (const type of BLOC_TYPES) {
      const props = proprietesPourBloc({ type });
      expect(props.length).toBeGreaterThan(0);
      expect(props.some((p) => p.type === 'text')).toBe(true);
      expect(props.some((p) => p.type === 'color' || p.type === 'color[]')).toBe(true);
      for (const p of props) {
        expect(p.id).toBeTruthy();
        expect(p.path).toBeTruthy();
        expect(['text', 'color', 'color[]', 'number', 'enum']).toContain(p.type);
      }
    }
  });

  it('get/setByPath roundtrip', () => {
    const bloc = { options: { style: {} } };
    const next = setByPath(bloc, 'options.style.fond', '#112233');
    expect(getByPath(next, 'options.style.fond')).toBe('#112233');
    expect(getByPath(next, 'options.style.bordure')).toBeUndefined();
  });

  it('patchByPath ne remonte ni le bloc entier ni sa métadonnée de grille', () => {
    const bloc = { id: 'b1', section: 'donnees', options: { note: 'Ancienne', style: { fond: '#ffffff' } } };
    expect(patchByPath(bloc, 'options.sousTitre', 'Nouveau')).toEqual({
      options: { note: 'Ancienne', style: { fond: '#ffffff' }, sousTitre: 'Nouveau' },
    });
    expect(patchByPath(bloc, 'options.style.fond', '#000000')).toEqual({
      options: { note: 'Ancienne', style: { fond: '#000000' } },
    });
  });

  it('normalise les couleurs hex, tailwind et rejette l’invalide', () => {
    expect(normaliserCouleur('#abc')).toBe('#abc');
    expect(normaliserCouleur('blue-600')).toMatch(/^#/);
    expect(normaliserCouleur('bogus')).toBe('');
  });

  it('calcule un contraste AA', () => {
    expect(contrasteRatio('#000000', '#ffffff')).toBeGreaterThan(4.5);
    expect(contrasteRatio(PALETTES.contraste[0], PALETTES.contraste[1])).toBeGreaterThan(4.5);
  });

  it('expose les helpers texteEditableProps/couleurProps', () => {
    const bloc = { type: 'kpi', titre: 'Titre', options: { style: { fond: '#ffffff' } } };
    expect(texteEditableProps(bloc).some((p) => p.id === 'titre' && p.valeur === 'Titre')).toBe(true);
    expect(couleurProps(bloc).some((p) => p.id === 'fond')).toBe(true);
  });
});
