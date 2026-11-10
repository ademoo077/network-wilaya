import { describe, expect, it } from 'vitest';
import { suggestAnomalyTypes } from '../src/typeSuggestions.js';

const domains = [
  { id: 1, name_fr: 'Voirie', name_ar: 'الطريق', actif: 1, types: [
    { id: 10, name_fr: 'Nid-de-poule', name_ar: 'حفرة' }, { id: 11, name_fr: 'Défaut de peinture', name_ar: 'نقص في الطلاء' },
  ] },
  { id: 2, name_ar: 'أرصفة', types: [{ id: 20, name_ar: 'حفرة' }, { id: 21, name_ar: 'عام' }] },
  { id: 3, name_ar: 'الإنارة العمومية', types: [{ id: 30, name_ar: 'مصابيح معطلة' }, { id: 31, name_ar: 'مصابيح محطمة', actif: 0 }] },
  { id: 4, actif: 0, name_fr: 'Ancienne catégorie', types: [{ id: 40, name_fr: 'Nid-de-poule' }] },
];
describe('Suggestions déterministes de types', () => {
  it('normalise diacritiques, tatweel, articles arabes et classe selon la catégorie citée', () => {
    const result = suggestAnomalyTypes('توجد حُفْرَةٌ كبيرة بالطـريق أمام الحي', domains);
    expect(result.map((row) => row.type_id)).toEqual([10, 20]);
    expect(result[0]).toMatchObject({ domaine_id: 1, matched_name: 'حفرة', match: 'phrase' });
  });
  it('reconnaît accents, casse, tirets et pluriel latin sans traduire les noms', () => {
    expect(suggestAnomalyTypes('Plusieurs NIDS DE POULE sur la voirie', domains)[0]?.type_id).toBe(10);
    expect(suggestAnomalyTypes('Un DEFAUT de peinture', domains)[0]?.type_id).toBe(11);
  });
  it('propose plusieurs types réellement présents et filtre les références inactives', () => {
    const ids = suggestAnomalyTypes('حفرة ومصابيح معطلة. مصابيح محطمة.', domains).map((row) => row.type_id);
    expect(ids).toContain(10); expect(ids).toContain(30); expect(ids).not.toContain(31); expect(ids).not.toContain(40);
  });
  it('ignore les URL, mots partiels, termes génériques et textes sans rapport', () => {
    for (const text of ['', 'عام', 'message du citoyen', 'https://example.test/hفرة/Nid-de-poule', 'المصابيح ليست مذكورة', 'حفرتان']) {
      expect(suggestAnomalyTypes(text, domains), text).toEqual([]);
    }
  });
  it('garde les catégories ambiguës et borne les suggestions', () => {
    expect(suggestAnomalyTypes('حفرة', domains)).toHaveLength(2);
    expect(suggestAnomalyTypes('حفرة', domains, { limit: 1, domaineId: 2 })[0]?.type_id).toBe(20);
  });
});
