import fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, anomalyPayload } from './helpers.js';
import { importTerritoire } from '../src/services/territoireImport.js';
import { createAnomalie } from '../src/services/anomalies.js';
import { bootstrap } from '../src/services/refs.js';
import { importInterventions } from '../src/services/interventions.js';
import { importRefRows, parseCsv } from '../src/services/refImport.js';
import { interventionCandidates } from '@anm/shared';

const read = (name) => fs.readFileSync(new URL(`../../seed/${name}`, import.meta.url), 'utf8');
const source = JSON.parse(read('territoire-alger.json'));
let db; let refs; let userIds;
beforeEach(() => { ({ db, refs, userIds } = freshDatabase()); });

describe('Référentiel territorial bilingue fourni', () => {
  it('importe exactement 14 daïras et 57 communes, avec leurs rattachements et textes FR/AR', () => {
    const preview = importTerritoire(db, source);
    expect(preview).toMatchObject({ committed: false, dairas: { total: 14, created: 14 }, communes: { total: 57, created: 57 } });
    expect(db.prepare('SELECT COUNT(*) AS n FROM communes').get().n).toBe(2);
    importTerritoire(db, source, { commit: true });
    const actual = bootstrap(db).dairas;
    for (const item of source) {
      const found = actual.find((row) => row.name_fr === item.name_fr);
      expect(found).toMatchObject({ name_ar: item.name_ar, actif: 1 });
      expect(found.communes.map(({ name_fr, name_ar }) => ({ name_fr, name_ar }))).toEqual(expect.arrayContaining(item.communes));
      expect(found.communes).toHaveLength(item.communes.length);
    }
    expect(importTerritoire(db, source, { commit: true })).toMatchObject({ dairas: { created: 0, updated: 0 }, communes: { created: 0, updated: 0 } });
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
  });

  it('corrige les colonnes inversées en conservant identifiant, anomalie, dates et désactivation', () => {
    db.prepare('UPDATE dairas SET name_fr=?,name_ar=? WHERE id=?').run('El Harrach', 'الحراش', refs.dairaId);
    db.prepare('UPDATE communes SET name_fr=?,name_ar=? WHERE id=?').run('باش جراح', 'Bach Djerrah', refs.communeId);
    const item = createAnomalie(db, anomalyPayload(refs), userIds.admin);
    db.prepare('UPDATE communes SET actif=0 WHERE id=?').run(refs.communeId);
    const before = db.prepare('SELECT * FROM anomalies WHERE id=?').get(item.id);
    const created = db.prepare('SELECT created_at FROM communes WHERE id=?').get(refs.communeId);
    expect(importTerritoire(db, source, { commit: true })).toMatchObject({ dairas: { created: 13 }, communes: { created: 56, updated: 1 } });
    expect(db.prepare('SELECT * FROM communes WHERE id=?').get(refs.communeId)).toMatchObject({ ...created, name_fr: 'Bach Djerrah', name_ar: 'باش جراح', actif: 0, daira_id: refs.dairaId });
    const after = db.prepare('SELECT * FROM anomalies WHERE id=?').get(item.id);
    expect({ ...after, search_norm: before.search_norm }).toEqual(before);
    expect(after.search_norm).toContain('bach djerrah');
    expect(after.search_norm).toContain('باش جراح');
  });

  it('préserve les libellés administrateur et refuse les associations ambiguës avant toute écriture', () => {
    importTerritoire(db, source, { commit: true });
    db.prepare('UPDATE communes SET name_fr=? WHERE name_fr=?').run('Libellé administrateur', 'El Marsa');
    importTerritoire(db, source, { commit: true });
    expect(db.prepare('SELECT name_fr FROM communes WHERE name_ar=?').get('المرسى').name_fr).toBe('Libellé administrateur');
    db.prepare('INSERT INTO dairas(name_fr,name_ar) VALUES (?,?)').run('Autre libellé', 'الرويبة');
    const before = db.prepare('SELECT * FROM communes').all();
    expect(() => importTerritoire(db, source, { commit: true })).toThrow(/ambigu/i);
    expect(db.prepare('SELECT * FROM communes').all()).toEqual(before);
  });

  it('couvre les 14 daïras par les périmètres NETCOM et EXTRANET dans les deux langues', () => {
    importTerritoire(db, source, { commit: true });
    importRefRows(db, 'epics', parseCsv(read('epics.csv')), { commit: true });
    importInterventions(db, JSON.parse(read('interventions-workflow.json')), JSON.parse(read('interventions-mapping.json')), { commit: true });
    const data = bootstrap(db); const domaine = data.domaines.find((row) => row.name_ar === 'نفايات منزلية');
    for (const [index, item] of source.entries()) {
      const daira = data.dairas.find((row) => row.name_fr === item.name_fr);
      for (const only of ['name_fr', 'name_ar']) {
        const candidates = interventionCandidates({ ...data, dairas: [{ id: daira.id, [only]: daira[only] }] }, { domaine_id: domaine.id, daira_id: daira.id });
        const expected = index < 6 ? 'NETCOM' : 'EXTRANET';
        expect(candidates.find((row) => row.epic.name === expected)?.proposed, `${daira[only]} → ${expected}`).toBe(true);
        expect(candidates.find((row) => row.epic.name === (index < 6 ? 'EXTRANET' : 'NETCOM'))?.proposed).toBe(false);
      }
    }
  });
});
