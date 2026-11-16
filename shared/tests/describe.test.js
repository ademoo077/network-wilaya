import { describe, expect, it } from 'vitest';
import { CATALOGUE, describeFiltre, describeFiltres, describeRequete } from '../src/index.js';

const recues = CATALOGUE.mesures.recues;
const daira = CATALOGUE.dimensions.daira;
const statut = CATALOGUE.filtres.statut;
const nonTraite = statut.valeurs.find((entry) => entry.id === 'non_traite');

const spec = {
  mesures: [{ id: 'recues' }],
  dimensions: [{ champ: 'daira' }],
  filtres: [{ champ: 'statut', op: 'in', valeur: ['non_traite'] }],
  periode: { mode: 'semaine' },
};

describe('describeRequete', () => {
  it('décrit mesures, dimensions, filtres et période en français', () => {
    const phrase = describeRequete(spec, 'fr');
    expect(phrase).toContain(recues.label_fr);
    expect(phrase).toContain(`par ${daira.label_fr}`);
    expect(phrase).toContain(`${statut.label_fr} parmi ${nonTraite.label_fr}`);
    expect(phrase).toContain('cette semaine');
    expect(phrase.endsWith('.')).toBe(true);
  });

  it('décrit la même requête en arabe', () => {
    const phrase = describeRequete(spec, 'ar');
    expect(phrase).toContain(recues.label_ar);
    expect(phrase).toContain(daira.label_ar);
    expect(phrase).toContain(nonTraite.label_ar);
    expect(phrase).toContain('هذا الأسبوع');
  });

  it('rend une plage explicite et une comparaison', () => {
    const phrase = describeRequete({
      mesures: [{ id: 'recues' }],
      dimensions: [],
      filtres: [],
      periode: { mode: 'plage', debut: '2026-11-10', fin: '2026-11-16' },
      comparaison: 'periode_precedente',
    }, 'fr');
    expect(phrase).toContain('du 2026-11-10 au 2026-11-16');
    expect(phrase).toContain('période précédente');
  });

  it('décrit un filtre booléen et un filtre vide', () => {
    expect(describeFiltre({ champ: 'gps', op: 'eq', valeur: true }, 'fr')).toContain('Oui');
    expect(describeFiltre({ champ: 'agent', op: 'is_null', valeur: true }, 'fr')).toContain('vide');
    expect(describeFiltre({ champ: 'agent', op: 'is_null', valeur: false }, 'fr')).toContain('renseigné');
  });

  it('retourne une liste de filtres et une chaîne vide sans mesure', () => {
    expect(describeFiltres({ filtres: [{ champ: 'gps', op: 'eq', valeur: false }] }, 'fr')).toHaveLength(1);
    expect(describeRequete({ dimensions: [] }, 'fr')).toBe('');
    expect(describeRequete(null, 'fr')).toBe('');
  });
});
