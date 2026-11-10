import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { importRefRows } from '../src/services/refImport.js';
import { freshDatabase, login, write } from './helpers.js';

let db; let agent; let csrf;
beforeAll(async () => { ({ db } = freshDatabase()); ({ agent, csrf } = await login(createApp())); });
describe('Coordonnées et grade des agents scooters', () => {
  it('conserve les agents antérieurs et accepte les nouveaux champs dans les créations et modifications', async () => {
    expect(db.prepare('SELECT grade,email FROM agents LIMIT 1').get()).toEqual({ grade: null, email: null });
    const response = await write(agent, csrf, 'post', '/api/ref/agents', { full_name: '[DEMO] عون', grade: 'مراقب طريق', email: 'Agent@example.test' });
    expect(response.status).toBe(201);
    expect(response.body.item).toMatchObject({ grade: 'مراقب طريق', email: 'Agent@example.test' });
    const updated = await write(agent, csrf, 'patch', `/api/ref/agents/${response.body.item.id}`, { grade: 'رئيس فرع تقني' });
    expect(updated.body.item.grade).toBe('رئيس فرع تقني');
    expect((await agent.get('/api/ref/bootstrap')).body.agents.find((item) => item.id === response.body.item.id).email).toBe('Agent@example.test');
  });
  it('rejette une adresse invalide à la frontière API et dans un import', async () => {
    expect((await write(agent, csrf, 'post', '/api/ref/agents', { full_name: '[DEMO] Incorrect', email: 'invalide' })).status).toBe(400);
    const result = importRefRows(db, 'agents', [{ full_name: '[DEMO] Incorrect', email: 'invalide' }]);
    expect(result.summary.error).toBe(1);
  });
  it('déduplique les e-mails sans tenir compte de la casse dans le fichier puis les relances', () => {
    const rows = [{ full_name: '[DEMO] Unique', email: 'unique@example.test', grade: 'مراقب طريق' },
      { full_name: '[DEMO] Unique répété', email: 'UNIQUE@example.test', grade: 'رئيس فرع تقني' }];
    expect(importRefRows(db, 'agents', rows, { commit: true }).summary).toMatchObject({ created: 1, warning: 1 });
    expect(importRefRows(db, 'agents', rows, { commit: true }).summary).toMatchObject({ created: 0, warning: 2 });
    expect(db.prepare('SELECT full_name,grade FROM agents WHERE email=?').get('unique@example.test')).toEqual({ full_name: '[DEMO] Unique', grade: 'مراقب طريق' });
    expect(db.pragma('foreign_key_check')).toEqual([]);
  });
});
