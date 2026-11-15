import { describe, it, expect } from 'vitest';
import {
  formatDateShort, formatNumber, formatValue, formatVariation, pluralDays,
} from '../src/format.js';

const compact = (value) => String(value).replace(/[\s\u202f\u00a0]/g, ' ');

describe('formatNumber', () => {
  it('formate les entiers avec séparateur de milliers', () => {
    expect(compact(formatNumber(1234567, 'fr'))).toBe('1 234 567');
    expect(compact(formatNumber(1234567, 'ar'))).toBe('1.234.567');
  });

  it('respecte les décimales demandées', () => {
    expect(formatNumber(3.4, 'fr', { minimumFractionDigits: 1, maximumFractionDigits: 1 })).toBe('3,4');
    expect(formatNumber(3, 'fr', { minimumFractionDigits: 1, maximumFractionDigits: 1 })).toBe('3,0');
  });

  it('affiche un tiret pour une valeur indéfinie', () => {
    expect(formatNumber(null, 'fr')).toBe('—');
    expect(formatNumber(undefined, 'fr')).toBe('—');
    expect(formatNumber('abc', 'fr')).toBe('—');
  });
});

describe('formatValue', () => {
  it('formate les entiers, décimaux et pourcentages', () => {
    expect(formatValue(12, 'entier', 'fr')).toBe('12');
    expect(formatValue(12.34, 'decimal', 'fr')).toBe('12,3');
    expect(formatValue(33.34, 'pourcentage', 'fr')).toBe('33,3 %');
    expect(formatValue(33.34, 'pourcentage', 'ar')).toBe('33,3 %');
  });

  it('accorde les jours au singulier et au pluriel', () => {
    expect(formatValue(0, 'jours', 'fr')).toBe('0 jours');
    expect(formatValue(1, 'jours', 'fr')).toBe('1 jour');
    expect(formatValue(2, 'jours', 'fr')).toBe('2 jours');
    expect(formatValue(1.5, 'jours', 'fr')).toBe('1,5 jours');
    expect(pluralDays(1, 'ar')).toBe('يوم');
    expect(pluralDays(2, 'ar')).toBe('أيام');
  });

  it('formate le couple effectif / part', () => {
    expect(formatValue({ n: 3, pct: 60 }, 'n_pct', 'fr')).toBe('3 (60,0 %)');
    expect(formatValue(null, 'n_pct', 'fr')).toBe('—');
  });

  it('formate les dates en JJ/MM/AAAA', () => {
    expect(formatDateShort('2026-11-15', 'fr')).toBe('15/11/2026');
    expect(formatDateShort('2026-02-30', 'fr')).toBe('—');
    expect(formatValue('2026-11-15', 'date', 'fr')).toBe('15/11/2026');
  });

  it('affiche un tiret pour toute valeur absente', () => {
    expect(formatValue(null, 'entier', 'fr')).toBe('—');
    expect(formatValue(undefined, 'pourcentage', 'ar')).toBe('—');
  });
});

describe('formatVariation', () => {
  it('distingue les points de pourcentage et la variation relative', () => {
    expect(formatVariation(2.3, 'points', 'fr')).toBe('+2,3 pts');
    expect(formatVariation(-1.5, 'points', 'fr')).toBe('-1,5 pts');
    expect(formatVariation(10, 'percent', 'fr')).toBe('+10,0 %');
    expect(formatVariation(null, 'percent', 'fr')).toBe('—');
  });
});
