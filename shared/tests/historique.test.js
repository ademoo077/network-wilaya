import { describe, it, expect } from 'vitest';
import {
  dateLisible, valeurLisible, formaterEntree, grouperHistorique, typeEvenement, tempsRelatif, HISTORIQUE_TYPES,
} from '../src/historique.js';

describe('dateLisible', () => {
  it('convertit une date ISO en JJ/MM/AAAA', () => {
    expect(dateLisible('2026-11-19')).toBe('19/11/2026');
    expect(dateLisible('2026-11-19T10:42:13.602Z')).toBe('19/11/2026');
  });
  it('rejette une valeur qui n’est pas une date', () => {
    expect(dateLisible('non_traite')).toBeNull();
    expect(dateLisible(null)).toBeNull();
  });
});

describe('valeurLisible', () => {
  it('traduit les codes de statut sans laisser fuir le technique', () => {
    expect(valeurLisible('statut', 'non_traite', 'fr')).toBe('Non traitée');
    expect(valeurLisible('statut', 'traite', 'fr')).toBe('Traitée');
    expect(valeurLisible('statut', 'en_cours', 'ar')).toBe('قيد المعالجة');
  });
  it('traduit les codes de classement et de priorité', () => {
    expect(valeurLisible('verification', 'infirmee', 'fr')).toBe('Sans suite');
    expect(valeurLisible('priorite', 'urgente', 'fr')).toBe('Urgente');
  });
  it('formate les dates et masque les identifiants numériques', () => {
    expect(valeurLisible('date_traitement', '2026-11-19', 'fr')).toBe('19/11/2026');
    expect(valeurLisible('agent_id', '12', 'fr')).toBeNull();
  });
  it('conserve une valeur textuelle libre', () => {
    expect(valeurLisible('observations', 'EGCTU', 'fr')).toBe('EGCTU');
  });
});

describe('formaterEntree', () => {
  it('produit un libellé, des valeurs lisibles et le motif', () => {
    const entre = formaterEntree({
      champ: 'statut', ancienne_valeur: 'non_traite', nouvelle_valeur: 'traite',
      motif: 'a', at: '2026-11-19T10:42:13.602Z', user_nom: 'Admin',
    }, 'fr');
    expect(entre.titre).toBe('Statut');
    expect(entre.avant).toBe('Non traitée');
    expect(entre.apres).toBe('Traitée');
    expect(entre.motif).toBe('a');
    expect(entre.type).toBe('statut');
    expect(entre.auteur).toBe('Admin');
  });
  it('ne montre aucune valeur technique pour un champ inconnu à identifiant', () => {
    const entre = formaterEntree({ champ: 'agent_id', ancienne_valeur: null, nouvelle_valeur: '7' }, 'fr');
    expect(entre.avant).toBeNull();
    expect(entre.apres).toBeNull();
  });
});

describe('grouperHistorique', () => {
  it('regroupe les entrées de la même minute et du même auteur', () => {
    const groupes = grouperHistorique([
      { champ: 'statut', ancienne_valeur: 'non_traite', nouvelle_valeur: 'en_cours', at: '2026-11-19T10:41:13.000Z', user_nom: 'Admin' },
      { champ: 'date_intervention', ancienne_valeur: null, nouvelle_valeur: '2026-11-19', at: '2026-11-19T10:41:13.000Z', user_nom: 'Admin' },
      { champ: 'statut', ancienne_valeur: 'en_cours', nouvelle_valeur: 'traite', at: '2026-11-19T10:42:13.000Z', user_nom: 'Admin' },
    ], 'fr');
    expect(groupes).toHaveLength(2);
    expect(groupes[0].evenements).toHaveLength(2);
    expect(groupes[1].evenements).toHaveLength(1);
  });
});

describe('typeEvenement', () => {
  it('attribue un type connu pour l’icône', () => {
    expect(typeEvenement('statut')).toBe('statut');
    expect(typeEvenement('gps')).toBe('localisation');
    expect(typeEvenement('inconnu')).toBe('details');
  });
});

describe('tempsRelatif', () => {
  const maintenant = Date.parse('2026-11-19T12:00:00.000Z');
  it('reste lisible et sans technique', () => {
    expect(tempsRelatif('2026-11-19T11:59:30.000Z', maintenant, 'fr')).toBe('à l’instant');
    expect(tempsRelatif('2026-11-19T11:42:00.000Z', maintenant, 'fr')).toBe('il y a 18 min');
    expect(tempsRelatif('2026-11-18T12:00:00.000Z', maintenant, 'ar')).toBe('منذ يوم');
    expect(tempsRelatif(null, maintenant)).toBe('');
  });
  it('expose des types de filtre stables', () => {
    expect(HISTORIQUE_TYPES).toContain('agent');
    expect(HISTORIQUE_TYPES).toContain('photo');
  });
});
