import { describe, it, expect, beforeAll } from 'vitest';
import { createAnomalie } from '../src/services/anomalies.js';
import { overview } from '../src/services/stats.js';
import { evaluateSynthese, clearSyntheseCache } from '../src/synthese/engine.js';
import { freshDatabase } from './helpers.js';

const TODAY = '2026-11-15';
const DEBUT = '2026-11-09';
const FIN = '2026-11-15';

let db;
let refs;
let userIds;

function payload(number, overrides = {}) {
  return {
    lien_url: `https://www.facebook.com/anm/synthese/${number}`,
    date_signalement: DEBUT,
    domaine_id: refs.domaineId,
    type_id: refs.typeId,
    daira_id: refs.dairaId,
    commune_id: refs.communeId,
    adresse_texte: 'Rue de test',
    motif: 'Test V8',
    ...overrides,
  };
}

function create(number, overrides) {
  return createAnomalie(db, payload(number, overrides), userIds.admin, { today: TODAY });
}

function requete(overrides) {
  return {
    dataset: 'anomalies',
    mesures: [{ id: 'recues' }],
    dimensions: [],
    filtres: [],
    periode: { mode: 'plage', debut: DEBUT, fin: FIN },
    ...overrides,
  };
}

function total(result, id) {
  return result.totaux.valeurs[id];
}

function ligne(result, dimensionId, key) {
  return result.lignes.find((row) => row.dimensions.some(
    (dimension) => dimension.id === dimensionId && String(dimension.key) === String(key),
  ));
}

beforeAll(() => {
  ({ db, refs, userIds } = freshDatabase());
  clearSyntheseCache();

  const confirmed = {
    verification: 'confirmee',
    agent_id: refs.agentId,
    epic_id: refs.epicId,
  };

  // A1 — reçue et traitée dans la période, urgente, commune 1.
  create(1, {
    ...confirmed,
    date_signalement: '2026-11-09',
    date_verification: '2026-11-10',
    date_intervention: '2026-11-10',
    date_traitement: '2026-11-10',
    statut: 'traite',
    priorite: 'urgente',
  });

  // A2 — reçue dans la période, en cours à la fin, haute, commune 1.
  create(2, {
    ...confirmed,
    date_signalement: '2026-11-10',
    date_verification: '2026-11-11',
    date_intervention: '2026-11-11',
    statut: 'en_cours',
    priorite: 'haute',
  });

  // A3 — reçue dans la période, à vérifier, non traitée, domaine 2.
  create(3, {
    date_signalement: '2026-11-11',
    verification: 'a_verifier',
    statut: 'non_traite',
    priorite: 'normale',
    domaine_id: refs.otherDomaineId,
    type_id: refs.otherTypeId,
    daira_id: refs.otherDairaId,
    commune_id: refs.otherCommuneId,
  });

  // A4 — reçue et traitée dans la période, normale, commune 2.
  create(4, {
    ...confirmed,
    date_signalement: '2026-11-12',
    date_verification: '2026-11-12',
    date_intervention: '2026-11-13',
    date_traitement: '2026-11-14',
    statut: 'traite',
    priorite: 'normale',
    daira_id: refs.otherDairaId,
    commune_id: refs.otherCommuneId,
  });

  // A5 — reçue avant la période, toujours ouverte, urgente : stock et retard.
  create(5, {
    ...confirmed,
    date_signalement: '2026-10-20',
    date_verification: '2026-10-21',
    statut: 'non_traite',
    priorite: 'urgente',
    domaine_id: refs.otherDomaineId,
    type_id: refs.otherTypeId,
    daira_id: refs.otherDairaId,
    commune_id: refs.otherCommuneId,
  });

  // A6 — infirmée : exclue de la population par défaut.
  create(6, {
    date_signalement: '2026-11-13',
    verification: 'infirmee',
    statut: 'non_traite',
    date_verification: '2026-11-14',
    agent_id: refs.agentId,
    motif: 'Infirmation de test',
  });

  // A7 — reçue et traitée le dernier jour, commune 1.
  create(7, {
    ...confirmed,
    date_signalement: '2026-11-15',
    date_verification: '2026-11-15',
    date_intervention: '2026-11-15',
    date_traitement: '2026-11-15',
    statut: 'traite',
    priorite: 'urgente',
  });
});

describe('moteur V8 — cohorte et cohérence avec stats.js', () => {
  it('compte les fiches reçues comme stats.overview', () => {
    const result = evaluateSynthese(db, requete(), { today: TODAY });
    const stats = overview(db, { from: DEBUT, to: FIN, today: TODAY });
    expect(total(result, 'recues')).toBe(stats.cohorte.total);
    expect(total(result, 'recues')).toBe(5);
    expect(result.meta.cache).toBe(false);
  });

  it('reproduit les statuts de la cohorte et le taux de traitement', () => {
    const result = evaluateSynthese(db, requete({
      mesures: [
        { id: 'recues' },
        { id: 'cohorte_non_traitees' },
        { id: 'cohorte_en_cours' },
        { id: 'cohorte_traitees' },
      ],
    }), { today: TODAY });
    const stats = overview(db, { from: DEBUT, to: FIN, today: TODAY });
    expect(total(result, 'cohorte_non_traitees')).toBe(stats.cohorte.non_traite);
    expect(total(result, 'cohorte_en_cours')).toBe(stats.cohorte.en_cours);
    expect(total(result, 'cohorte_traitees')).toBe(stats.cohorte.traite);
    expect(total(result, 'recues')).toBe(5);
  });

  it('calcule le taux de traitement en pourcentage 0–100', () => {
    const result = evaluateSynthese(db, requete({
      mesures: [{ id: 'taux_traitement' }],
    }), { today: TODAY });
    const stats = overview(db, { from: DEBUT, to: FIN, today: TODAY });
    expect(total(result, 'taux_traitement')).toBeCloseTo(stats.taux_traitement * 100, 1);
    expect(total(result, 'taux_traitement')).toBe(60);
  });

  it('calcule le délai moyen sur les fiches traitées dans la période', () => {
    const result = evaluateSynthese(db, requete({
      mesures: [{ id: 'delai_moyen' }],
    }), { today: TODAY });
    const stats = overview(db, { from: DEBUT, to: FIN, today: TODAY });
    expect(total(result, 'delai_moyen')).toBeCloseTo(stats.delai_moyen_jours, 1);
    expect(total(result, 'delai_moyen')).toBe(1);
  });

  it('calcule le stock, le retard et les urgentes ouvertes', () => {
    const stock = evaluateSynthese(db, requete({
      mesures: [{ id: 'stock_debut' }, { id: 'stock_fin' }, { id: 'variation_stock' }, { id: 'en_retard' }],
    }), { today: TODAY });
    const urgentes = evaluateSynthese(db, requete({
      mesures: [{ id: 'urgentes_ouvertes' }],
    }), { today: TODAY });
    const stats = overview(db, { from: DEBUT, to: FIN, today: TODAY });
    expect(total(stock, 'stock_debut')).toBe(1);
    expect(total(stock, 'stock_fin')).toBe(3);
    expect(total(stock, 'variation_stock')).toBe(2);
    expect(total(stock, 'en_retard')).toBe(stats.en_retard);
    expect(total(urgentes, 'urgentes_ouvertes')).toBe(stats.urgentes_ouvertes);
  });

  it('répartit les parts de cohorte au plus grand reste, somme = 100,0 %', () => {
    const result = evaluateSynthese(db, requete({
      mesures: [
        { id: 'cohorte_pct_non_traitees' },
        { id: 'cohorte_pct_en_cours' },
        { id: 'cohorte_pct_traitees' },
      ],
    }), { today: TODAY });
    const values = ['cohorte_pct_non_traitees', 'cohorte_pct_en_cours', 'cohorte_pct_traitees']
      .map((id) => total(result, id));
    expect(values).toEqual([20, 20, 60]);
    expect(values.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 10);
  });

  it('calcule les taux de confirmation et d’infirmation sur les fiches vérifiées', () => {
    const result = evaluateSynthese(db, requete({
      mesures: [{ id: 'taux_confirmation' }, { id: 'taux_infirmation' }],
    }), { today: TODAY });
    expect(total(result, 'taux_confirmation')).toBe(80);
    expect(total(result, 'taux_infirmation')).toBe(20);
  });
});

describe('moteur V8 — dimensions, filtres et temps', () => {
  it('agrège par domaine et conserve le total', () => {
    const result = evaluateSynthese(db, requete({
      dimensions: [{ champ: 'domaine' }],
    }), { today: TODAY });
    expect(result.lignes).toHaveLength(2);
    expect(total(result, 'recues')).toBe(5);
    expect(ligne(result, 'domaine', refs.domaineId).valeurs.recues).toBe(4);
    expect(ligne(result, 'domaine', refs.otherDomaineId).valeurs.recues).toBe(1);
  });

  it('applique un filtre de liste en ET avec la période', () => {
    const result = evaluateSynthese(db, requete({
      filtres: [{ champ: 'domaine', op: 'in', valeur: [refs.domaineId] }],
    }), { today: TODAY });
    expect(total(result, 'recues')).toBe(4);
  });

  it('remplit les jours sans données pour une dimension temporelle', () => {
    const result = evaluateSynthese(db, requete({
      dimensions: [{ champ: 'signalement', granularite: 'jour' }],
    }), { today: TODAY });
    expect(result.lignes).toHaveLength(7);
    const values = result.lignes.map((row) => row.valeurs.recues);
    expect(values).toEqual([1, 1, 1, 1, 0, 0, 1]);
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(5);
  });

  it('regroupe les lignes au-delà de la limite dans « Autres »', () => {
    const result = evaluateSynthese(db, requete({
      dimensions: [{ champ: 'commune' }],
      limite: 1,
      regrouper_autres: true,
    }), { today: TODAY });
    expect(result.lignes).toHaveLength(2);
    expect(result.lignes[0].valeurs.recues).toBe(3);
    expect(result.lignes[1].autre).toBe(true);
    expect(result.lignes[1].valeurs.recues).toBe(2);
    expect(result.lignes[1].dimensions[0].label_fr).toBe('Autres');
  });

  it('compare à la période précédente sans recalcul côté client', () => {
    const result = evaluateSynthese(db, requete({
      comparaison: 'periode_precedente',
    }), { today: TODAY });
    expect(result.lignes[0].comparaison.recues).toBe(0);
    expect(result.lignes[0].variations.recues.abs).toBe(5);
  });
});

describe('moteur V8 — sécurité et cache', () => {
  it('refuse un identifiant de mesure hors catalogue', () => {
    expect(() => evaluateSynthese(db, requete({
      mesures: [{ id: 'recues; DROP TABLE anomalies' }],
    }), { today: TODAY })).toThrow();
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='anomalies'").get()).toBeTruthy();
  });

  it('refuse un champ de filtre hors catalogue', () => {
    expect(() => evaluateSynthese(db, requete({
      filtres: [{ champ: 'a.statut', op: 'eq', valeur: 'traite' }],
    }), { today: TODAY })).toThrow();
  });

  it('traite une chaîne dangereuse comme une simple valeur liée', () => {
    const result = evaluateSynthese(db, requete({
      filtres: [{ champ: 'q', op: 'contains', valeur: "' OR 1=1 --" }],
    }), { today: TODAY });
    expect(total(result, 'recues')).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM anomalies').get().n).toBe(7);
  });

  it('refuse une mesure incompatible avec une dimension', () => {
    expect(() => evaluateSynthese(db, requete({
      mesures: [{ id: 'delai_moyen' }],
      dimensions: [{ champ: 'statut' }],
    }), { today: TODAY })).toThrow(/compatible/);
  });

  it('exige une granularité pour une dimension temporelle', () => {
    expect(() => evaluateSynthese(db, requete({
      dimensions: [{ champ: 'signalement' }],
    }), { today: TODAY })).toThrow(/Granularité/);
  });

  it('met en cache puis invalide après écriture', () => {
    clearSyntheseCache();
    const spec = requete();
    const first = evaluateSynthese(db, spec, { today: TODAY });
    const second = evaluateSynthese(db, spec, { today: TODAY });
    expect(first.meta.cache).toBe(false);
    expect(second.meta.cache).toBe(true);
    const before = second.meta.data_version;

    create(8, {
      date_signalement: '2026-11-15',
      verification: 'a_verifier',
      statut: 'non_traite',
      priorite: 'normale',
    });

    const third = evaluateSynthese(db, spec, { today: TODAY });
    expect(third.meta.cache).toBe(false);
    expect(third.meta.data_version).toBeGreaterThan(before);
    expect(total(third, 'recues')).toBe(6);
  });
});
