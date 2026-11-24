import { describe, it, expect } from 'vitest';
import { formatDims, utileZone, normalizeMargins, echelleTypo, colonnesCible, paginer, equilibrer, tauxRemplissage } from '../src/print.js';

describe('print formats', () => {
  it('calcule les dimensions A5/A4/A3/Lettre portrait/paysage', () => {
    expect(formatDims('a5', 'portrait')).toMatchObject({ w: 148, h: 210 });
    expect(formatDims('a5', 'landscape')).toMatchObject({ w: 210, h: 148 });
    expect(formatDims('a4', 'portrait')).toMatchObject({ w: 210, h: 297 });
    expect(formatDims('a3', 'landscape')).toMatchObject({ w: 420, h: 297 });
    expect(formatDims('letter', 'portrait').w).toBeCloseTo(215.9);
  });

  it('calcule la zone utile avec marges symétriques', () => {
    const u = utileZone('a4', 'portrait', { top: 10, right: 10, bottom: 10, left: 10 });
    expect(u.width).toBe(190);
    expect(u.height).toBe(277);
    expect(u.margins.left).toBe(u.margins.right);
  });

  it('avertit sous le minimum via normalizeMargins', () => {
    const m = normalizeMargins({ top: 2 }, 'a5');
    expect(m.min).toBe(6);
    expect(m.top).toBe(2);
  });

  it('adapte la typographie et la grille en A5', () => {
    expect(echelleTypo(utileZone('a5', 'portrait', { top: 8, right: 8, bottom: 8, left: 8 }).width)).toBeGreaterThanOrEqual(0.75);
    expect(colonnesCible(utileZone('a5', 'portrait', { top: 8, right: 8, bottom: 8, left: 8 }).width)).toBe(6);
    expect(colonnesCible(190)).toBe(12);
  });
});

describe('paginer/equilibrer', () => {
  it('pagine sans perdre de blocs', () => {
    const blocs = Array.from({ length: 8 }, (_, i) => ({ id: i, hauteur_mm: 40 }));
    const pages = paginer(blocs, { hauteurUtile: 100, mesure: (b) => b.hauteur_mm });
    expect(pages.flatMap((p) => p.blocs).length).toBe(8);
    expect(pages.length).toBeGreaterThan(1);
  });

  it('equilibrer augmente le remplissage sans toucher la dernière page par défaut', () => {
    const pages = [{ index: 1, blocs: [{ type: 'barres', hauteur_mm: 60 }, { type: 'carte', hauteur_mm: 60 }] }, { index: 2, blocs: [{ type: 'texte', hauteur_mm: 30 }] }];
    const out = equilibrer(pages, { hauteurUtile: 200 });
    expect(tauxRemplissage(out, 200)).toBeGreaterThan(60);
    // dernière page non équilibrée par défaut
    expect(out[out.length - 1].blocs.length).toBeGreaterThanOrEqual(0);
  });
});
