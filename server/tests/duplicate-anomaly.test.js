import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createAnomalie } from '../src/services/anomalies.js';
import { freshDatabase, login, anomalyPayload, write } from './helpers.js';

let db; let refs; let original; let session; let app;
beforeEach(async () => {
  ({ db, refs } = freshDatabase()); app = createApp(); session = await login(app, 'operateur');
  original = createAnomalie(db, anomalyPayload(refs, { gps: { lat: 36.75, lng: 3.05 }, gps_source: 'carte',
    verification: 'confirmee', agent_id: refs.agentId, epic_id: refs.epicId, statut: 'en_cours',
    observations: 'Ne pas répliquer les notes de traitement', date_intervention: '2026-10-02' }), session.user.id);
});
describe('Duplication explicite pour une publication multi-anomalies', () => {
  it('conserve le contexte mais remet à zéro position, vérification, traitement et notes', async () => {
    const response = await write(session.agent, session.csrf, 'post', `/api/anomalies/${original.id}/dupliquer`, {
      domaine_id: refs.otherDomaineId, type_id: refs.otherTypeId,
    });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const item = response.body.item;
    expect(item.id).not.toBe(original.id); expect(item.reference).not.toBe(original.reference);
    expect(item).toMatchObject({ lien_url: original.lien_url, daira_id: original.daira_id, commune_id: original.commune_id,
      date_signalement: original.date_signalement, gps: null, gps_source: null, verification: 'a_verifier',
      statut: 'non_traite', agent_id: null, epic_id: null, date_intervention: null, observations: null });
    expect(db.prepare('SELECT COUNT(*) AS n FROM anomalies').get().n).toBe(2);
    expect(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='ANOMALIE_CREATE'").get().n).toBe(1);
  });
  it('refuse toujours un doublon strict et applique authentification, CSRF et rôle', async () => {
    const path = `/api/anomalies/${original.id}/dupliquer`;
    const duplicate = { domaine_id: refs.domaineId, type_id: refs.typeId, gps: original.gps };
    const strict = await write(session.agent, session.csrf, 'post', path, duplicate);
    expect(strict.status).toBe(409); expect(strict.body.error.code).toBe('DUPLICATE_STRICT');
    expect((await session.agent.post(path).send(duplicate)).status).toBe(403);
    const reader = await login(app, 'lecteur'); expect((await write(reader.agent, reader.csrf, 'post', path, duplicate)).status).toBe(403);
    expect((await write(session.agent, session.csrf, 'post', '/api/anomalies/9999/dupliquer', duplicate)).status).toBe(404);
    expect(db.prepare('SELECT COUNT(*) AS n FROM anomalies').get().n).toBe(1);
  });
});
