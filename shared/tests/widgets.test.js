import { describe, expect, it } from 'vitest';
import {
  BLOC_TYPES, CATALOGUE, GALERIE, GALERIE_FAMILLES, galeriePayload, recommendedVisual,
  validerRequete,
} from '../src/index.js';

const timeDimension = (champ) => ({ champ, granularite: 'semaine' });

describe('galerie de widgets V8.2', () => {
  it('propose au moins 35 widgets prêts à l’emploi, ids uniques', () => {
    expect(GALERIE.length).toBeGreaterThanOrEqual(35);
    expect(new Set(GALERIE.map((widget) => widget.id)).size).toBe(GALERIE.length);
    expect(GALERIE.length).toBe(42);
  });

  it('valide chaque requête contre le catalogue, sans SQL libre', () => {
    for (const widget of GALERIE) {
      if (!widget.requete) continue;
      expect(() => validerRequete(widget.requete)).not.toThrow();
      expect(widget.requete.dataset).toBe('anomalies');
      expect(widget.requete.periode).toEqual({ mode: 'herite' });
      expect(JSON.stringify(widget.requete)).not.toMatch(/\b(select|from|where|join|insert|update|delete)\b/i);
    }
  });

  it('déclare un visuel connu, un titre FR et AR, une famille connue', () => {
    const types = new Set(BLOC_TYPES);
    const familles = new Set(GALERIE_FAMILLES.map((famille) => famille.id));
    for (const widget of GALERIE) {
      expect(types.has(widget.visuel)).toBe(true);
      expect(familles.has(widget.famille)).toBe(true);
      expect(widget.titre_fr.length).toBeGreaterThan(2);
      expect(widget.titre_ar.length).toBeGreaterThan(2);
    }
  });

  it('rend une phrase de synthèse FR et AR pour chaque widget de données', () => {
    for (const widget of galeriePayload('fr')) {
      if (!widget.requete) continue;
      expect(widget.description).toBeTruthy();
      expect(widget.description.length).toBeGreaterThan(4);
    }
    for (const widget of galeriePayload('ar')) {
      if (!widget.requete) continue;
      expect(widget.description).toBeTruthy();
      expect(widget.description).not.toBe(galeriePayload('fr').find((item) => item.id === widget.id).description);
    }
  });

  it('recommande un visuel cohérent avec la forme de la requête', () => {
    expect(recommendedVisual({ mesures: [{ id: 'recues' }], dimensions: [] })).toBe('kpi');
    expect(recommendedVisual({ mesures: [{ id: 'recues' }], dimensions: [timeDimension('signalement')] })).toBe('courbe');
    expect(recommendedVisual({ mesures: [{ id: 'recues' }], dimensions: [{ champ: 'tranche_age' }] })).toBe('histogramme');
    expect(recommendedVisual({ mesures: [{ id: 'recues' }], dimensions: [{ champ: 'statut' }] })).toBe('anneau');
    expect(recommendedVisual({ mesures: [{ id: 'taux_sla' }], dimensions: [{ champ: 'epic' }] })).toBe('anneau');
    expect(recommendedVisual({ mesures: [{ id: 'recues' }], dimensions: [{ champ: 'daira' }, { champ: 'type' }] })).toBe('carte_thermique');
    expect(recommendedVisual({ mesures: [{ id: 'recues' }], dimensions: [{ champ: 'daira' }] })).toBe('barres');
  });

  it('n’expose que des mesures et dimensions du catalogue', () => {
    const mesures = new Set(CATALOGUE.mesures ? Object.keys(CATALOGUE.mesures) : []);
    const dimensions = new Set(CATALOGUE.dimensions ? Object.keys(CATALOGUE.dimensions) : []);
    for (const widget of GALERIE) {
      for (const mesure of widget.requete?.mesures || []) expect(mesures.has(mesure.id)).toBe(true);
      for (const dimension of widget.requete?.dimensions || []) {
        expect(dimensions.has(String(dimension.champ).replace(/^t\./, ''))).toBe(true);
      }
    }
  });
});
