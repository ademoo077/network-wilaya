import { describe, it, expect } from 'vitest';
import { parseGps, formatGps } from '../src/gps.js';

const BBOX = '36.40,2.50,36.95,3.40';

describe('parseGps', () => {
  it('accepte les formats texte usuels', () => {
    expect(parseGps('36.7538, 3.0588').lat).toBeCloseTo(36.7538, 6);
    expect(parseGps('36.7538 3.0588').lng).toBeCloseTo(3.0588, 6);
    expect(parseGps('36,7538 ; 3,0588').lat).toBeCloseTo(36.7538, 6);
    expect(parseGps('36.7538°N 3.0588°E').ok).toBe(true);
  });

  it('extrait les coordonnées des liens Google Maps et OSM', () => {
    expect(parseGps('https://www.google.com/maps/@36.7538,3.0588,15z').lat).toBeCloseTo(36.7538, 6);
    expect(parseGps('https://maps.google.com/?q=36.7538,3.0588').lng).toBeCloseTo(3.0588, 6);
    expect(parseGps('https://www.openstreetmap.org/#map=15/36.7538/3.0588').lat).toBeCloseTo(36.7538, 6);
  });

  it('signale un lien court non résolu', () => {
    const result = parseGps('https://maps.app.goo.gl/abc123');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('LIEN_COURT_NON_RESOLU');
  });

  it('inverse lat/lng quand manifestement inversés', () => {
    const result = parseGps('3.0588, 36.7538');
    expect(result.swapped).toBe(true);
    expect(result.lat).toBeCloseTo(36.7538, 6);
  });

  it('avertit hors bbox sans bloquer', () => {
    const result = parseGps('48.8566, 2.3522', { bbox: BBOX });
    expect(result.ok).toBe(true);
    expect(result.warning).toBe('GPS_HORS_ZONE');
  });

  it('refuse les coordonnées hors plage', () => {
    expect(parseGps('95, 3').ok).toBe(false);
    expect(parseGps('12, 200').ok).toBe(false);
  });

  it('retourne null pour une saisie vide', () => {
    expect(parseGps('')).toEqual({ ok: true, lat: null, lng: null });
  });

  it('arrondit à 6 décimales', () => {
    expect(parseGps('36.123456789, 3.987654321').lat).toBe(36.123457);
    expect(formatGps(36.7538, 3.0588)).toBe('36.753800, 3.058800');
  });
});
