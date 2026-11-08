import { describe, it, expect } from 'vitest';
import { splitPercent, percent, variation } from '../src/percent.js';

describe('splitPercent', () => {
  it('totalise exactement 100,0 %', () => {
    const values = splitPercent([1, 1, 1]);
    expect(values).toEqual([33.4, 33.3, 33.3]);
    expect(values.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
  });

  it('gère les tiers et les petits effectifs', () => {
    expect(splitPercent([1, 0, 0])).toEqual([100, 0, 0]);
    expect(splitPercent([2, 1, 0])).toEqual([66.7, 33.3, 0]);
    expect(splitPercent([0, 0, 1])).toEqual([0, 0, 100]);
  });

  it('retourne null quand le total est nul', () => {
    expect(splitPercent([0, 0, 0])).toEqual([null, null, null]);
    expect(splitPercent([])).toEqual([]);
  });

  it('ignore les valeurs négatives ou invalides', () => {
    expect(splitPercent([-2, 1, 1])).toEqual([0, 50, 50]);
    expect(splitPercent(['x', 1, 1])).toEqual([0, 50, 50]);
  });
});

describe('percent et variation', () => {
  it('arrondit à une décimale et gère la division par zéro', () => {
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(0, 0)).toBeNull();
    expect(percent(5, 2)).toBe(250);
  });

  it('calcule les variations en % et en points', () => {
    expect(variation(12, 10)).toBe(20);
    expect(variation(10, 0)).toBeNull();
    expect(variation(0.6, 0.5, 'points')).toBe(10);
    expect(variation(null, 10)).toBeNull();
  });
});
