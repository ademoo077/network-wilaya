import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { interventionCandidates } from '@anm/shared';
import { createApp } from '../src/app.js';
import { importInterventions } from '../src/services/interventions.js';
import { importRefRows, parseCsv } from '../src/services/refImport.js';
import { bootstrap } from '../src/services/refs.js';
import { freshDatabase, login, write } from './helpers.js';

const source = JSON.parse(fs.readFileSync(new URL('../../seed/interventions-workflow.json', import.meta.url), 'utf8'));
const mapping = JSON.parse(fs.readFileSync(new URL('../../seed/interventions-mapping.json', import.meta.url), 'utf8'));
let db; let agent; let csrf;
beforeAll(async () => {
  ({ db } = freshDatabase()); ({ agent, csrf } = await login(createApp()));
  importRefRows(db, 'epics', parseCsv(fs.readFileSync(new URL('../../seed/epics.csv', import.meta.url))), { commit: true });
});
const domainId = (name) => db.prepare('SELECT id FROM domaines WHERE name_ar=?').get(name).id;
describe('Workflow des intervenants fourni par la cellule', () => {
  it('importe 11 descriptions vers 12 fiches, conserve les missions et les référentiels existants', () => {
    const counts = db.prepare('SELECT (SELECT COUNT(*) FROM dairas) AS dairas,(SELECT COUNT(*) FROM epics) AS epics').get();
    expect(importInterventions(db, source, mapping)).toMatchObject({ total: 12, nouveaux: 12, committed: false });
    expect(db.prepare('SELECT COUNT(*) AS n FROM epics WHERE workflow_json IS NOT NULL').get().n).toBe(0);
    expect(importInterventions(db, source, mapping, { commit: true })).toMatchObject({ total: 12, nouveaux: 12 });
    const refs = bootstrap(db);
    for (const entry of mapping) for (const name of entry.epics) {
      const epic = refs.epics.find((item) => item.name === name);
      expect(epic.workflow.missions).toEqual(source['المؤسسات'].find((item) => item['المؤسسة'] === entry.source)['المهام']);
      expect(epic.domaine_ids.length).toBeGreaterThan(0);
    }
    expect(refs.epics.find((item) => item.name === 'DRE').workflow.coordination).toEqual(['DRE', 'SEAAL']);
    expect(db.prepare('SELECT (SELECT COUNT(*) FROM dairas) AS dairas,(SELECT COUNT(*) FROM epics) AS epics').get()).toEqual(counts);
  });
  it('répartit exactement les 6 daïras NETCOM et les 8 daïras EXTRANET, en FR et AR', () => {
    const refs = bootstrap(db); const domaine_id = domainId('نفايات منزلية');
    for (const name of ['NETCOM', 'EXTRANET']) {
      const rule = mapping.find((item) => item.source === name);
      const arabic = rule.dairas.filter((value) => /[\u0600-\u06ff]/.test(value));
      expect(arabic).toHaveLength(name === 'NETCOM' ? 6 : 8);
      for (const name_fr of rule.dairas) {
        const items = interventionCandidates({ ...refs, dairas: [{ id: 999, name_fr }] }, { domaine_id, daira_id: 999 });
        expect(items.filter((item) => item.proposed && ['NETCOM', 'EXTRANET'].includes(item.epic.name)).map((item) => item.epic.name)).toEqual([name]);
      }
    }
    expect(interventionCandidates(refs, { domaine_id }).filter((item) => item.proposed && item.epic.name === 'NETCOM')[0].state).toBe('conditional');
  });
  it('explique les seuils et exceptions sans appliquer un choix ni exclure toute Sidi Abdellah', () => {
    const refs = { ...bootstrap(db), dairas: [{ id: 900, name_ar: 'سيدي عبد الله' }] };
    const values = { domaine_id: domainId('الإنارة العمومية'), daira_id: 900, epic_id: 'manuel' };
    const erma = interventionCandidates(refs, values).find((item) => item.epic.name === 'ERMA');
    expect(erma).toMatchObject({ proposed: true, state: 'conditional' });
    expect(erma.notes[0].note_fr).toContain('sauf les quartiers AADL');
    expect(values.epic_id).toBe('manuel');
    const road = interventionCandidates(refs, { domaine_id: domainId('الطريق') });
    expect(road.find((item) => item.epic.name === 'ASROUT').notes[0].note_fr).toContain('moins de 100 m');
    expect(road.find((item) => item.epic.name === 'DTP')).toMatchObject({ state: 'conditional' });
    expect(road.find((item) => item.epic.name === 'DTP').notes[0].note_fr).toContain('100 m exactement');
  });
  it('filtre les missions par type et conserve les éditions admin lors d’une relance', async () => {
    const refs = bootstrap(db); const epic = refs.epics.find((item) => item.name === 'البلدية');
    const domain = domainId('واجهات المباني');
    const type = db.prepare('SELECT id FROM types_anomalie WHERE domaine_id=? AND name_ar=?').get(domain, 'جدار آيل للسقوط');
    expect(interventionCandidates(refs, { domaine_id: domain, type_id: type.id }).find((item) => item.epic.id === epic.id).proposed).toBe(false);
    const workflow = { ...epic.workflow, missions: ['[DEMO] Mission précisée par l’administrateur'] };
    const response = await write(agent, csrf, 'patch', `/api/ref/epics/${epic.id}`, { workflow });
    expect(response.status).toBe(200); expect(response.body.item.workflow.missions).toEqual(workflow.missions);
    expect(importInterventions(db, source, mapping, { commit: true }).nouveaux).toBe(0);
    expect(bootstrap(db).epics.find((item) => item.id === epic.id).workflow.missions).toEqual(workflow.missions);
    const reader = await login(createApp(), 'lecteur');
    expect((await write(reader.agent, reader.csrf, 'patch', `/api/ref/epics/${epic.id}`, { workflow: null })).status).toBe(403);
    expect(db.pragma('foreign_key_check')).toEqual([]);
  });
});
