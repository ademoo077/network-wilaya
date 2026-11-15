import { describe, it, expect } from 'vitest';
import {
  CATALOGUE, CATALOGUE_VERSION, DATASETS, DIMENSIONS, DIMENSION_IDS, FILTRES, FILTER_IDS,
  FORMATS, GRANULARITES, GRANULARITE_IDS, MEASURES, MEASURE_IDS, OPS, OP_IDS,
  findDimension, measureCompatible,
} from '../src/catalogue.js';
import { FORMAT_IDS } from '../src/format.js';

const LISTS = [
  ['datasets', DATASETS],
  ['dimensions', DIMENSIONS],
  ['mesures', MEASURES],
  ['filtres', FILTRES],
  ['formats', FORMATS],
  ['granularites', GRANULARITES],
  ['ops', OPS],
];

const SNAKE = /^[a-z][a-z0-9_]*$/;

function expectComplete(entry, listName) {
  expect(entry.id, `${listName} id`).toMatch(SNAKE);
  for (const key of ['label_fr', 'label_ar', 'description_fr', 'description_ar']) {
    expect(typeof entry[key], `${listName}.${entry.id}.${key}`).toBe('string');
    expect(entry[key].trim().length, `${listName}.${entry.id}.${key}`).toBeGreaterThan(0);
  }
}

describe('catalogue V8 — complétude bilingue', () => {
  it('déclare la version 8.0.0', () => {
    expect(CATALOGUE_VERSION).toBe('8.0.0');
    expect(CATALOGUE.version).toBe(CATALOGUE_VERSION);
  });

  it.each(LISTS)('expose des entrées %s complètes, uniques et en snake_case', (name, list) => {
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    const ids = new Set();
    for (const entry of list) {
      expectComplete(entry, name);
      expect(ids.has(entry.id), `${name} : doublon ${entry.id}`).toBe(false);
      ids.add(entry.id);
    }
  });

  it('aligne les index du catalogue et les listes d’identifiants', () => {
    expect(Object.keys(CATALOGUE.datasets)).toEqual(DATASETS.map((item) => item.id));
    expect(Object.keys(CATALOGUE.dimensions)).toEqual(DIMENSION_IDS);
    expect(Object.keys(CATALOGUE.mesures)).toEqual(MEASURE_IDS);
    expect(Object.keys(CATALOGUE.filtres)).toEqual(FILTER_IDS);
    expect(Object.keys(CATALOGUE.formats)).toEqual(FORMAT_IDS);
    expect(Object.keys(CATALOGUE.granularites)).toEqual(GRANULARITE_IDS);
    expect(Object.keys(CATALOGUE.ops)).toEqual(OP_IDS);
    expect(CATALOGUE.formats_ids).toEqual(FORMAT_IDS);
  });

  it('ne rend évaluable que le jeu anomalies en P1', () => {
    expect(DATASETS.filter((dataset) => dataset.disponible).map((dataset) => dataset.id)).toEqual(['anomalies']);
  });
});

describe('catalogue V8 — dimensions et mesures', () => {
  it('déclare des valeurs bilingues pour chaque dimension énumérée', () => {
    for (const dimension of DIMENSIONS.filter((item) => item.valeurs)) {
      expect(dimension.valeurs.length, dimension.id).toBeGreaterThan(0);
      for (const value of dimension.valeurs) {
        expect(value.label_fr.trim(), `${dimension.id}/${value.id}`).not.toBe('');
        expect(value.label_ar.trim(), `${dimension.id}/${value.id}`).not.toBe('');
      }
    }
  });

  it('fournit une granularité pour chaque dimension temporelle', () => {
    for (const dimension of DIMENSIONS.filter((item) => item.kind === 'time')) {
      expect(dimension.granularites, dimension.id).toEqual(GRANULARITE_IDS);
    }
  });

  it('range chaque mesure dans une base temporelle connue et un format connu', () => {
    const bases = new Set(['cohorte', 'traitement', 'verification', 'intervention', 'stock', 'derivee']);
    for (const mesure of MEASURES) {
      expect(bases.has(mesure.temporal), `${mesure.id} : base ${mesure.temporal}`).toBe(true);
      expect(FORMAT_IDS).toContain(mesure.format);
    }
  });

  it('relie chaque mesure dérivée à ses sources', () => {
    for (const mesure of MEASURES.filter((item) => item.derivee === 'difference')) {
      expect(mesure.from, mesure.id).toHaveLength(2);
      for (const source of mesure.from) expect(CATALOGUE.mesures[source], `${mesure.id} ← ${source}`).toBeTruthy();
    }
    for (const mesure of MEASURES.filter((item) => item.derivee === 'partition')) {
      expect(mesure.partition.length, mesure.id).toBeGreaterThan(1);
      for (const source of mesure.partition) expect(CATALOGUE.mesures[source], `${mesure.id} ← ${source}`).toBeTruthy();
    }
  });

  it('retrouve les dimensions, y compris le préfixe temporel t.', () => {
    expect(findDimension('domaine')?.id).toBe('domaine');
    expect(findDimension('t.signalement')?.id).toBe('signalement');
    expect(findDimension('inconnue')).toBeNull();
    expect(findDimension('')).toBeNull();
  });

  it('refuse les mesures non additives sur les dimensions de statut', () => {
    expect(measureCompatible('delai_moyen', 'statut')).toBe(false);
    expect(measureCompatible('delai_median', 'statut_fin')).toBe(false);
    expect(measureCompatible('delai_p90', 't.statut')).toBe(false);
    expect(measureCompatible('delai_moyen', 'domaine')).toBe(true);
    expect(measureCompatible('recues', 'statut')).toBe(true);
    expect(measureCompatible('inexistante', 'statut')).toBe(false);
  });
});
