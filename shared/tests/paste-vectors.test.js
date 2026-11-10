import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSmartPaste } from '../src/smartPaste.js';
import { classifyUrl } from '../src/smartPasteUrls.js';

const vectors = JSON.parse(readFileSync(path.resolve(process.cwd(), 'tests/fixtures/paste-vectors.json'), 'utf8'));

const options = { bbox: '36.40,2.50,36.95,3.40', today: '2026-12-31' };

function coordOk(result, attente) {
  if (attente.position) {
    expect(result.coords.length).toBeGreaterThan(0);
    expect(result.coords[0].lat).toBeCloseTo(attente.position[0], 4);
    expect(result.coords[0].lng).toBeCloseTo(attente.position[1], 4);
    expect(result.coords[0].source).toBe(attente.source);
  } else {
    expect(result.coords).toHaveLength(0);
  }
}

describe('V6 — vecteurs de collage (tests/fixtures/paste-vectors.json)', () => {
  it('fournit au moins 40 vecteurs de collage documentes', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(40);
  });

  for (const vector of vectors) {
    it(`vecteur ${vector.id} — ${vector.description}`, () => {
      const result = parseSmartPaste(vector.texte, options);
      const attente = vector.attente || {};
      if (attente.resolutionAttendue) {
        expect(result.coords).toHaveLength(0);
        expect(result.urls[0].a_resoudre).toBe(true);
        return;
      }
      if (attente.positions) {
        expect(result.coords).toHaveLength(attente.positions.length);
        attente.positions.forEach(([lat, lng], index) => {
          expect(result.coords[index].lat).toBeCloseTo(lat, 5);
          expect(result.coords[index].lng).toBeCloseTo(lng, 5);
        });
        return;
      }
      coordOk(result, attente);
      if (attente.dateEstimee) expect(result.dates.some((date) => date.estimee)).toBe(true);
      if (Object.hasOwn(attente, 'lieu')) expect(result.urls[0].lieu ?? null).toBe(attente.lieu);
      if (attente.plateforme) {
        const classified = classifyUrl(vector.texte);
        expect(classified.plateforme).toBe(attente.plateforme);
        expect(classified.contenuType).toBe(attente.contenu);
      }
    });
  }

  it('decoupe un message multi_positions en plusieurs positions', () => {
    const result = parseSmartPaste('Point A 36.75,3.05 et point B 36.78,3.09', options);
    expect(result.coords).toHaveLength(2);
  });
});
