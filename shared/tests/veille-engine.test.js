import { describe, it, expect } from 'vitest';
import {
  analyserTexte, confidenceFor, detectLanguage, geoFilterAllows, hammingDistance, isNearDuplicate,
  normalizeArabic, normalizeForMatch, normalizeTerm, percentileRank, priorityFor, resolveTerritory,
  scoreMatches, simhash64, termsToRemove, viraliteScore,
} from '@anm/shared';

const lexique = [
  { id: 1, terme: 'nid de poule', terme_norm: normalizeTerm('nid de poule', 'fr'), langue: 'fr', role: 'theme', groupe_id: 'Voirie', poids: 3, actif: 1 },
  { id: 2, terme: 'trou', terme_norm: normalizeTerm('trou', 'fr'), langue: 'fr', role: 'theme', groupe_id: 'Voirie', poids: 2, actif: 1 },
  { id: 3, terme: 'urgent', terme_norm: normalizeTerm('urgent', 'fr'), langue: 'fr', role: 'urgence', groupe_id: null, poids: 3, actif: 1 },
  { id: 4, terme: 'à vendre', terme_norm: normalizeTerm('à vendre', 'fr'), langue: 'fr', role: 'exclusion', groupe_id: null, poids: -3, actif: 1 },
  { id: 5, terme: 'نفايات', terme_norm: normalizeTerm('نفايات', 'ar'), langue: 'ar', role: 'theme', groupe_id: 'Propreté', poids: 3, actif: 1 },
];

describe('Moteur Veille — normalisation et langue', () => {
  it('normalise diacritiques, alef, yaa, taa marbuta, tatweel et répétitions', () => {
    expect(normalizeArabic('النِّفَايَاتُ')).toBe('النفايات');
    expect(normalizeArabic('أإآٱىة')).toBe('اايه');
    expect(normalizeArabic('مرااااه')).toBe('مرااه');
    expect(normalizeForMatch('النِّفَايَاتُ')).toContain('نفاي');
  });

  it('détecte arabe, français et mixte', () => {
    expect(detectLanguage('تراكم النفايات في الشارع')).toBe('ar');
    expect(detectLanguage("nid de poule sur l'avenue")).toBe('fr');
    expect(detectLanguage('نفايات à Bab El Oued')).toBe('mix');
  });

  it('normalise l’arabizi et les termes darija', () => {
    expect(normalizeForMatch('zbel fi zenqa')).toContain('zbel');
    expect(normalizeTerm('زبالة', 'ar')).toBe(normalizeTerm('زبالات', 'ar'));
  });
});

describe('Moteur Veille — correspondance, score et priorité', () => {
  it('trouve une expression multi-mots et ignore le motif plus court chevauché', () => {
    const result = scoreMatches([{ row: lexique[0], occurrences: 1 }], { seuils: { suggestion: 4, pertinent: 2 } });
    expect(result.suggestions[0].groupe_id).toBe('Voirie');
    expect(result.suggestions[0].raisons[0].terme).toBe('nid de poule');
  });

  it('calcule les seuils de confiance juste en dessous et au-dessus', () => {
    expect(confidenceFor(3, 1, { suggestion: 4, pertinent: 2 })).toBe('basse');
    expect(confidenceFor(4, 1, { suggestion: 4, pertinent: 2 })).toBe('moyenne');
    expect(confidenceFor(7, 2, { suggestion: 4, pertinent: 2 })).toBe('haute');
    expect(confidenceFor(1, 1, { suggestion: 4, pertinent: 2 })).toBeNull();
  });

  it('applique le malus d’exclusion et la priorité urgence', () => {
    const result = analyserTexte('Nid de poule urgent à vendre', lexique, { seuils: { suggestion: 4, pertinent: 2 } });
    expect(result.score).toBe(0);
    expect(result.confidence).toBeNull();
    expect(result.urgent).toBe(true);
    expect(result.priorite).toBe('haute');
    expect(priorityFor({ urgent: true, viral: true })).toBe('urgente');
    expect(priorityFor({ urgent: true, groupeNom: 'Risques naturels' })).toBe('urgente');
    expect(priorityFor({ urgent: false, viral: false })).toBe('normale');
  });
});

describe('Moteur Veille — territoire, doublons, viralité', () => {
  const communes = [{ id: 1, daira_id: 10, name_fr: 'Bab El Oued', name_ar: 'باب الوادي' }];
  it('résout alias, commune et source par ordre de priorité', () => {
    expect(resolveTerritory({ text: 'à باب الوادي', communes }).commune_id).toBe(1);
    expect(resolveTerritory({ text: 'quartier El Ourici', aliases: [{ alias: 'El Ourici', alias_norm: 'el ourici', commune_id: 1, daira_id: 10, actif: 1 }], communes }).source_geo).toBe('alias');
    expect(resolveTerritory({ text: 'ailleurs', communes, sourceCommuneId: 1 }).source_geo).toBe('source');
    expect(geoFilterAllows(null, 'strict')).toBe(false);
    expect(geoFilterAllows(null, 'aucun')).toBe(true);
  });

  it('mesure simhash et distance de Hamming', () => {
    expect(hammingDistance('0000000000000000', '0000000000000000')).toBe(0);
    expect(hammingDistance('0000000000000000', '0000000000000007')).toBe(3);
    expect(hammingDistance('0000000000000000', '000000000000000f')).toBe(4);
    expect(isNearDuplicate('0000000000000000', '0000000000000007', 3)).toBe(true);
    expect(isNearDuplicate('0000000000000000', '000000000000000f', 3)).toBe(false);
    expect(simhash64('نفايات في الشارع')).toBe(simhash64('نفايات في الشارع'));
  });

  it('calcule la viralité au percentile de la source', () => {
    expect(viraliteScore({ reactions: 2, commentaires: 3, partages: 4 })).toBe(20);
    expect(percentileRank(10, [1, 2, 10, 20])).toBeCloseTo(0.625);
    expect(percentileRank(10, [])).toBe(0);
  });

  it('propose le retrait d’un terme sous 20 % de précision', () => {
    const stats = [
      { id: 1, terme: 'bruit', vus: 20, acceptes: 1, rejetes: 19 },
      { id: 2, terme: 'utile', vus: 20, acceptes: 18, rejetes: 2 },
    ];
    expect(termsToRemove(stats).map((term) => term.terme)).toEqual(['bruit']);
  });
});
