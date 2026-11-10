import { z } from 'zod';
import { normalize } from './normalize.js';

const name = z.string().trim().min(1).max(200);
const bilingual = z.object({ name_fr: name, name_ar: name });
export const territoireSchema = z.array(bilingual.extend({ communes: z.array(bilingual).min(1).max(200) })).min(1).max(100)
  .superRefine((dairas, ctx) => {
    const seen = { dairas: new Set(), communes: new Set() };
    for (const daira of dairas) {
      for (const [kind, entries] of [['dairas', [daira]], ['communes', daira.communes]]) {
        for (const entry of entries) for (const value of [entry.name_fr, entry.name_ar]) {
          const key = normalize(value);
          if (seen[kind].has(key)) ctx.addIssue({ code: 'custom', message: `Territoire en doublon : ${value}` });
          seen[kind].add(key);
        }
      }
    }
  });

/** Variantes fournies dans le workflow et dans le référentiel territorial. */
export function territoryKey(value) {
  const key = normalize(value).replace(/[^\p{L}\p{N}]/gu, '');
  return ({ دراريه: 'الدراريه', رويبه: 'الرويبه', sidiabdellah: 'sidiabdallah' })[key] || key;
}
