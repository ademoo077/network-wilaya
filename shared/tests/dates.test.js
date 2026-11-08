import { describe, it, expect } from 'vitest';
import {
  todayAlgiers, isDateString, parseDateUtc, addDays, diffDays, dayOfWeek,
  weekStart, weekEnd, monthStart, eachWeek, formatDate, formatDateTime, isFuture,
  previousPeriod, clampPeriod,
} from '../src/dates.js';

describe('dates', () => {
  it('calcule la date d’Alger même autour de minuit UTC', () => {
    expect(todayAlgiers(new Date('2026-11-08T22:30:00Z'))).toBe('2026-11-08');
    expect(todayAlgiers(new Date('2026-11-08T23:30:00Z'))).toBe('2026-11-09');
  });

  it('valide strictement AAAA-MM-JJ', () => {
    expect(isDateString('2026-02-28')).toBe(true);
    expect(isDateString('2026-02-29')).toBe(false);
    expect(isDateString('2024-02-29')).toBe(true);
    expect(isDateString('2026-2-3')).toBe(false);
    expect(isDateString('2026-13-01')).toBe(false);
  });

  it('construit des dates UTC et fait de l’arithmétique', () => {
    expect(parseDateUtc('2026-11-08').toISOString()).toBe('2026-11-08T00:00:00.000Z');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(diffDays('2026-11-01', '2026-11-08')).toBe(7);
    expect(dayOfWeek('2026-11-08')).toBe(0);
  });

  it('calcule le début de semaine pour les 7 réglages', () => {
    expect(weekStart('2026-11-08', 0)).toBe('2026-11-08');
    expect(weekStart('2026-11-08', 1)).toBe('2026-11-02');
    expect(weekStart('2026-11-08', 6)).toBe('2026-11-07');
    expect(weekEnd('2026-11-08', 1)).toBe('2026-11-08');
    expect(monthStart('2026-11-08')).toBe('2026-11-01');
  });

  it('génère des semaines et la période précédente', () => {
    expect(eachWeek('2026-10-01', '2026-10-31')).toHaveLength(5);
    expect(previousPeriod('2026-11-02', '2026-11-08')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(clampPeriod('2026-01-01', '2026-11-08', 30)).toEqual({ from: '2026-10-09', to: '2026-11-08' });
  });

  it('formate en chiffres occidentaux et heure d’Alger', () => {
    expect(formatDate('2026-11-08')).toBe('08/11/2026');
    expect(formatDate(null)).toBe('—');
    expect(formatDateTime('2026-11-08T23:30:00Z')).toBe('09/11/2026 00:30');
  });

  it('détecte les dates futures', () => {
    expect(isFuture('2026-11-09', '2026-11-08')).toBe(true);
    expect(isFuture('2026-11-08', '2026-11-08')).toBe(false);
  });
});
