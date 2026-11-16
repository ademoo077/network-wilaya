import { describe, expect, it, beforeAll } from 'vitest';
import { ensureSystemModels, SYSTEM_MODELS } from '../src/synthese/systemModels.js';
import { createModele, listModeles } from '../src/services/syntheses.js';
import { freshDatabase } from './helpers.js';

let db;
let userIds;

beforeAll(() => {
  ({ db, userIds } = freshDatabase());
});

describe('modèles système V8', () => {
  it('sème huit modèles système de façon idempotente', () => {
    expect(ensureSystemModels(db)).toBe(8);
    ensureSystemModels(db);
    const rows = db.prepare("SELECT * FROM syntheses_modeles WHERE portee = 'systeme' AND archive = 0").all();
    expect(rows).toHaveLength(8);
    expect(new Set(rows.map((row) => row.cle_systeme))).toEqual(new Set(SYSTEM_MODELS.map((model) => model.cle)));
    expect(rows.every((row) => row.version === 1)).toBe(true);
    for (const row of rows) {
      const definition = JSON.parse(row.definition_json);
      expect(definition.sections.length).toBeGreaterThan(0);
    }
  });

  it('ne touche jamais aux copies personnelles', () => {
    const admin = { id: userIds.admin, role: 'admin' };
    const source = db.prepare("SELECT * FROM syntheses_modeles WHERE cle_systeme = 'hebdomadaire'").get();
    const copy = createModele(db, admin, { nom: 'Ma synthèse hebdomadaire', definition: JSON.parse(source.definition_json) });
    expect(copy.cle_systeme).toBeNull();
    ensureSystemModels(db);
    const still = db.prepare('SELECT * FROM syntheses_modeles WHERE id = ?').get(copy.id);
    expect(still.nom).toBe('Ma synthèse hebdomadaire');
    expect(still.cle_systeme).toBeNull();
  });

  it('expose les huit modèles système en lecture à un lecteur', () => {
    const items = listModeles(db, { id: userIds.lecteur, role: 'lecteur' });
    const systemes = items.filter((item) => item.portee === 'systeme');
    expect(systemes).toHaveLength(8);
    expect(systemes.every((item) => item.modifiable === false)).toBe(true);
  });

  it('refuse de supprimer un modèle système au niveau SQL', () => {
    const row = db.prepare("SELECT id FROM syntheses_modeles WHERE cle_systeme = 'hebdomadaire'").get();
    expect(() => db.prepare('DELETE FROM syntheses_modeles WHERE id = ?').run(row.id)).toThrow(/système/i);
  });
});
