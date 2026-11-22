import { describe, it, expect } from 'vitest';
import { decodeMultipartFilename, safeDisplayFilename } from '../src/utils/filenames.js';

describe('V13 — noms de fichiers multipart', () => {
  it('décode les accents mojibakés', () => {
    expect(decodeMultipartFilename('Par daÃ¯ra.png')).toBe('Par daïra.png');
    expect(safeDisplayFilename('Par daÃ¯ra.png')).toBe('Par daïra.png');
  });

  it('conserve les noms arabes, emoji et déjà corrects', () => {
    expect(safeDisplayFilename('تقرير الحي.png')).toBe('تقرير الحي.png');
    expect(safeDisplayFilename('Rapport 🚧.jpg')).toBe('Rapport 🚧.jpg');
    expect(safeDisplayFilename('Rapport direction.png')).toBe('Rapport direction.png');
  });

  it('assainit les chemins et les caractères de contrôle', () => {
    expect(safeDisplayFilename('..\\..\\secret?.png')).toBe('secret_.png');
    expect(safeDisplayFilename('a\u0000b.png')).toBe('a_b.png');
    expect(safeDisplayFilename('')).toBe('piece');
  });
});
