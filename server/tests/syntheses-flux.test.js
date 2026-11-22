import { describe, it, expect, beforeAll } from 'vitest';
import { convertirDefinitionsEnFlux } from '../src/synthese/fluxMigration.js';
import { freshDatabase, USERS } from './helpers.js';

let db;

const definitionV1 = {
  schema_version: 1,
  sections: [{
    id: 's',
    colonnes: [[
      { id: 'anneau', type: 'anneau', options: { largeur: 'simple' } },
      { id: 'tab', type: 'tableau', options: { largeur: 'double' } },
    ]],
  }],
  layout: {
    schema_version: 1,
    widgets: [
      { id: 'anneau', x: 0, y: 0, w: 5, h: 4 },
      { id: 'tab', x: 5, y: 0, w: 7, h: 4 },
    ],
  },
};

beforeAll(() => {
  ({ db } = freshDatabase());
});

describe('V15 — migration 017 des définitions de synthèse', () => {
  it('convertit une copie personnelle sans toucher au snapshot figé', () => {
    const adminId = Number(db.prepare('SELECT id FROM users WHERE username = ?').get(USERS.admin.username).id);
    const modeleId = Number(db.prepare(`INSERT INTO syntheses_modeles
      (nom, description, proprietaire_id, portee, definition_json, schema_version, version)
      VALUES (?, ?, ?, 'prive', ?, 1, 1)`)
      .run('Copie V14', 'Copie à migrer', adminId, JSON.stringify(definitionV1)).lastInsertRowid);
    const snapshot = JSON.stringify({ definition: definitionV1, chiffres: { recues: 12 } });
    const editionId = Number(db.prepare(`INSERT INTO syntheses_editions
      (modele_id, periode_debut, periode_fin, parametres_json, version, statut, snapshot_json, figee_le)
      VALUES (?, '2026-11-16', '2026-11-22', '{}', 1, 'fige', ?, '2026-11-22T12:00:00.000Z')`)
      .run(modeleId, snapshot).lastInsertRowid);

    const resultat = convertirDefinitionsEnFlux(db);
    expect(resultat.convertis).toBe(1);

    const modele = db.prepare('SELECT definition_json FROM syntheses_modeles WHERE id = ?').get(modeleId);
    const definition = JSON.parse(modele.definition_json);
    expect(definition.layout.schema_version).toBe(2);
    expect(definition.layout.widgets.map((widget) => widget.largeur)).toEqual([6, 8]);
    expect(definition.layout.widgets.every((widget) => widget.hauteur === 'auto')).toBe(true);

    const edition = db.prepare('SELECT snapshot_json FROM syntheses_editions WHERE id = ?').get(editionId);
    expect(JSON.parse(edition.snapshot_json)).toEqual(JSON.parse(snapshot));
    expect(db.prepare('SELECT modele_id FROM synthese_flux_migrations WHERE modele_id = ?').get(modeleId)).toBeTruthy();
  });

  it('est idempotente', () => {
    const second = convertirDefinitionsEnFlux(db);
    expect(second.convertis).toBe(0);
    expect(second.dejaFlux).toBeGreaterThanOrEqual(1);
  });

  it('laisse les modèles système à ensureSystemModels', () => {
    const systeme = db.prepare("SELECT COUNT(*) AS c FROM synthese_flux_migrations m JOIN syntheses_modeles s ON s.id = m.modele_id WHERE s.cle_systeme IS NOT NULL").get().c;
    expect(systeme).toBe(0);
  });
});
