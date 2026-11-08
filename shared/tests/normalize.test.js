import { describe, it, expect } from 'vitest';
import { normalize, buildSearchNorm, escapeLike } from '../src/normalize.js';

describe('normalize', () => {
  it('supprime les accents latins et met en minuscules', () => {
    expect(normalize('ÉLECTRICITÉ Publique')).toBe('electricite publique');
  });

  it('supprime les diacritiques arabes et le tatweel', () => {
    expect(normalize('الطَّرِيقْ السَّـــريع')).toBe('الطريق السريع');
  });

  it('unifie alef, ya et ta marbouta', () => {
    expect(normalize('أإآٱ')).toBe('اااا');
    expect(normalize('مستشفى')).toBe('مستشفي');
    expect(normalize('مدينة')).toBe('مدينه');
  });

  it('compacte les espaces et gère null/undefined', () => {
    expect(normalize('  a   b \n c ')).toBe('a b c');
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
  });

  it('construit search_norm sans valeurs vides', () => {
    expect(buildSearchNorm(['ANM-2026-00001', null, 'Rue  Didouche', '', 'Éclairage']))
      .toBe('anm-2026-00001 rue didouche eclairage');
  });

  it('échappe les jokers LIKE', () => {
    expect(escapeLike('100%_ok\\')).toBe('100\\%\\_ok\\\\');
  });
});
