import { describe, expect, it } from 'vitest';
import { boundingBox, geometryBounds, gridKey, haversineMeters, pointInGeometry } from '../src/geo.js';

const polygon = {
  type: 'Polygon',
  coordinates: [
    [[2, 36], [4, 36], [4, 38], [2, 38], [2, 36]],
    [[2.5, 36.5], [3, 36.5], [3, 37], [2.5, 37], [2.5, 36.5]],
  ],
};

describe('Géométrie partagée V5', () => {
  it('calcule une distance Haversine connue', () => {
    expect(haversineMeters({ lat: 36.7538, lng: 3.0588 }, { lat: 36.7638, lng: 3.0588 })).toBeCloseTo(1112, -1);
  });
  it('retourne zéro pour le même point', () => expect(haversineMeters({ lat: 36, lng: 3 }, { lat: 36, lng: 3 })).toBe(0));
  it('refuse un point invalide', () => expect(haversineMeters({ lat: 99, lng: 3 }, { lat: 36, lng: 3 })).toBeNull());
  it('produit une boîte englobante contenant le point', () => {
    const box = boundingBox(36.75, 3.05, 300);
    expect(box.minLat).toBeLessThan(36.75); expect(box.maxLng).toBeGreaterThan(3.05);
  });
  it('génère une grille stable à trois décimales', () => expect(gridKey(36.75381, 3.05881)).toBe('36.754,3.059'));
  it('détecte un point intérieur', () => expect(pointInGeometry(37.5, 3.5, polygon)).toBe(true));
  it('rejette un point extérieur', () => expect(pointInGeometry(39, 3, polygon)).toBe(false));
  it('accepte la bordure extérieure', () => expect(pointInGeometry(36, 3, polygon)).toBe(true));
  it('rejette un point dans un trou', () => expect(pointInGeometry(36.75, 2.75, polygon)).toBe(false));
  it('gère un MultiPolygon', () => {
    const geometry = { type: 'MultiPolygon', coordinates: [polygon.coordinates, [[[5, 35], [6, 35], [6, 36], [5, 36], [5, 35]]]] };
    expect(pointInGeometry(35.5, 5.5, geometry)).toBe(true);
  });
  it('calcule les bornes et le nombre de sommets', () => {
    expect(geometryBounds(polygon)).toMatchObject({ minLat: 36, minLng: 2, maxLat: 38, maxLng: 4, vertices: 10 });
  });
  it('refuse les géométries non surfaciques', () => expect(geometryBounds({ type: 'Point', coordinates: [3, 36] })).toBeNull());
});
