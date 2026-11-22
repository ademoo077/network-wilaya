import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const read = (name) => JSON.parse(readFileSync(new URL(`../../client/src/i18n/${name}.json`, import.meta.url), 'utf8'));
const prefixes = ['field.', 'form.', 'detail.', 'status.', 'action.', 'audit.ANOMALIE_', 'verification.', 'work.', 'map.', 'import.', 'anomalies.'];
const anomalyEntries = (dict) => Object.entries(dict).filter(([key]) => prefixes.some((prefix) => key.startsWith(prefix)));

describe('V13 — dictionnaires du flux anomalie', () => {
  it('ne contiennent aucune mention de vérification en français', () => {
    for (const name of ['fr', 'fr-v6']) {
      for (const [key, value] of anomalyEntries(read(name))) {
        expect(value, `${name}:${key}`).not.toMatch(/\bvérification\b|\bvérifiée?\b|\bverification\b/i);
      }
    }
  });

  it('ne contiennent aucune mention de vérification en arabe', () => {
    for (const name of ['ar', 'ar-v6']) {
      for (const [key, value] of anomalyEntries(read(name))) {
        expect(value, `${name}:${key}`).not.toMatch(/التحقق|للتحقق|تم التحقق/);
      }
    }
  });

  it('exposent les libellés dynamiques et les nouvelles exigences', () => {
    const fr = read('fr'); const ar = read('ar');
    for (const key of ['form.requirement', 'form.advancedSummary', 'form.agentAuto', 'form.agentModify',
      'form.agentNoCandidate', 'form.intervenant', 'form.otherIntervenant', 'field.otherPartyName']) {
      expect(fr[key], key).toBeTruthy();
      expect(ar[key], key).toBeTruthy();
    }
  });
});
