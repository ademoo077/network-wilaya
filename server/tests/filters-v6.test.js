import { beforeAll, describe, expect, it } from 'vitest';
import { addDays, todayAlgiers } from '@anm/shared';
import { createApp } from '../src/app.js';
import { createAnomalie } from '../src/services/anomalies.js';
import { activite } from '../src/services/activity.js';
import { freshDatabase, login, anomalyPayload } from './helpers.js';

let db; let agent;
beforeAll(async () => {
  const setup = freshDatabase(); db = setup.db; const refs = setup.refs;
  ({ agent } = await login(createApp(), 'admin'));
  for (let i = 0; i < 4; i += 1) createAnomalie(db, anomalyPayload(refs, {
    lien_url: `https://facebook.com/posts/filters-${i}`, gps: i % 2 ? { lat: 36.75, lng: 3.05 } : null,
    date_signalement: addDays(todayAlgiers(), -30), priorite: i === 0 ? 'urgente' : 'normale',
    verification: i === 3 ? 'infirmee' : 'confirmee', agent_id: refs.agentId, motif: 'Signalement infirmé',
  }), 1);
});
describe('Filtres V6 et activité groupée', () => {
  it('applique la même population au compteur et à la liste GPS', async () => {
    const absent = await agent.get('/api/anomalies?gps=absent');
    const present = await agent.get('/api/anomalies?gps=present');
    const all = await agent.get('/api/anomalies?include_infirmees=1');
    expect(absent.body.total).toBe(2); expect(present.body.total).toBe(1); expect(all.body.total).toBe(4);
    expect((await agent.get('/api/anomalies/counts?gps=absent')).body.item.all).toBe(2);
    expect((await agent.get('/api/anomalies?gps=invalide')).status).toBe(400);
  });
  it('filtre les retards et urgentes avec les paramètres de la base', async () => {
    expect((await agent.get('/api/anomalies?retard=1')).body.total).toBe(3);
    expect((await agent.get('/api/anomalies?priorite=urgente&sla_depassee=1')).body.total).toBe(1);
    const counts = (await agent.get('/api/anomalies/counts')).body.item;
    expect(counts.retard).toBe(3); expect(counts.urgentes).toBe(1);
  });
  it('renvoie tous les points de la carte et un compte sans GPS identique à la liste', async () => {
    for (const filters of ['', 'include_infirmees=1', 'q=filters-1', 'priorite=urgente', 'daira=2', 'gps=present']) {
      const map = await agent.get(`/api/anomalies/map?${filters}`);
      const list = await agent.get(`/api/anomalies?${filters}`);
      expect(map.status).toBe(200);
      expect(map.body.total).toBe(list.body.total);
      expect(map.body.missing).toBe(list.body.items.filter((item) => !item.gps).length);
      expect(map.body.items.map((item) => item.id).sort()).toEqual(list.body.items.filter((item) => item.gps).map((item) => item.id).sort());
      expect(map.body.items.every((item) => item.gps && !('lien_url' in item))).toBe(true);
    }
    expect((await agent.get('/api/anomalies/map?daira=invalide')).status).toBe(400);
  });
  it('regroupe les changements distincts par fiche, utilisateur et minute avant la limite', () => {
    const row = db.prepare('SELECT id FROM anomalies ORDER BY id LIMIT 1').get();
    const insert = db.prepare('INSERT INTO anomalie_historique(anomalie_id,user_id,champ,ancienne_valeur,nouvelle_valeur,at) VALUES (?,?,?,?,?,?)');
    for (const field of ['adresse_texte', 'lieu_dit', 'priorite', 'priorite']) insert.run(row.id, 1, field, 'avant', 'après', '2026-12-01T12:34:01Z');
    const actions = activite(db, 1);
    expect(actions).toHaveLength(1); expect(actions[0].modifications).toBe(3); expect(actions[0].changements).toHaveLength(3);
  });
});
