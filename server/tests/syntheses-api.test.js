import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { todayAlgiers } from '@anm/shared';
import { createApp } from '../src/app.js';
import { createAnomalie } from '../src/services/anomalies.js';
import { freshDatabase, login, write } from './helpers.js';

let app;
let db;
let refs;
let userIds;

const TODAY = todayAlgiers();

const requete = {
  dataset: 'anomalies',
  mesures: [{ id: 'recues' }],
  dimensions: [],
  filtres: [],
  periode: { mode: 'glissant', jours: 7 },
};

const bloc = (id) => ({ id, type: 'kpi', requete });
const definition = { schema_version: 1, sections: [{ id: 'section-1', colonnes: [[bloc('bloc-1')]] }] };

function payload(overrides = {}) {
  return { nom: 'Synthèse de test', description: 'Modèle API', definition, ...overrides };
}

beforeAll(() => {
  ({ db, refs, userIds } = freshDatabase());
  createAnomalie(db, {
    lien_url: 'https://www.facebook.com/anm/synthese/api-1',
    date_signalement: TODAY,
    domaine_id: refs.domaineId,
    type_id: refs.typeId,
    daira_id: refs.dairaId,
    commune_id: refs.communeId,
    adresse_texte: 'Rue de test',
  }, userIds.admin, { today: TODAY });
  app = createApp();
});

describe('API Synthèses — catalogue et requêtes', () => {
  it('exige une session et expose le catalogue bilingue', async () => {
    expect((await request(app).get('/api/syntheses/catalogue')).status).toBe(401);
    const { agent } = await login(app, 'lecteur');
    const res = await agent.get('/api/syntheses/catalogue');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('8.0.0');
    expect(res.body.mesures).toHaveLength(38);
    expect(res.body.dimensions).toHaveLength(30);
    expect(res.body.filtres).toHaveLength(30);
    const recues = res.body.mesures.find((item) => item.id === 'recues');
    expect(recues.label_fr).toBeTruthy();
    expect(recues.label_ar).toBeTruthy();
  });

  it('normalise une requête et refuse une clé inconnue', async () => {
    const { agent, csrf } = await login(app, 'operateur');
    const ok = await write(agent, csrf, 'post', '/api/syntheses/requete', requete);
    expect(ok.status).toBe(200);
    expect(ok.body.item.mesures).toEqual([{ id: 'recues' }]);
    const bad = await write(agent, csrf, 'post', '/api/syntheses/requete', { ...requete, sql: 'SELECT 1' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION');
  });

  it('évalue un lot et applique la permission « fiches supprimées »', async () => {
    const { agent, csrf } = await login(app, 'operateur');
    const res = await write(agent, csrf, 'post', '/api/syntheses/evaluer', { requetes: [requete] });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].lignes[0].valeurs.recues).toBe(1);
    expect(res.body.items[0].totaux.valeurs.recues).toBe(1);

    const sansTotaux = await write(agent, csrf, 'post', '/api/syntheses/evaluer', {
      requetes: [{ ...requete, totaux: false }],
    });
    expect(sansTotaux.status).toBe(200);
    expect(sansTotaux.body.items[0].totaux).toBeNull();

    const refuse = await write(agent, csrf, 'post', '/api/syntheses/evaluer', {
      requetes: [{ ...requete, inclure_supprimees: true }],
    });
    expect(refuse.status).toBe(403);
    expect(refuse.body.error.code).toBe('FORBIDDEN');

    const admin = await login(app, 'admin');
    const accepte = await write(admin.agent, admin.csrf, 'post', '/api/syntheses/evaluer', {
      requetes: [{ ...requete, inclure_supprimees: true }],
    });
    expect(accepte.status).toBe(200);
  });

  it('limite le lot à vingt requêtes et refuse un lot invalide en bloc', async () => {
    const { agent, csrf } = await login(app, 'operateur');
    const trop = await write(agent, csrf, 'post', '/api/syntheses/evaluer', {
      requetes: Array.from({ length: 21 }, () => requete),
    });
    expect(trop.status).toBe(400);
    const invalide = await write(agent, csrf, 'post', '/api/syntheses/evaluer', {
      requetes: [requete, { ...requete, mesures: [{ id: 'injection' }] }],
    });
    expect(invalide.status).toBe(400);
    expect(invalide.body.error.message).toMatch(/Requête 2/);
  });
});

describe('API Synthèses — modèles', () => {
  it('réserve l’écriture aux rôles autorisés et exige le CSRF', async () => {
    const reader = await login(app, 'lecteur');
    const list = await reader.agent.get('/api/syntheses/modeles');
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([]);
    expect((await write(reader.agent, reader.csrf, 'post', '/api/syntheses/modeles', payload())).status).toBe(403);

    const operator = await login(app, 'operateur');
    const sansCsrf = await operator.agent.post('/api/syntheses/modeles').send(payload());
    expect(sansCsrf.status).toBe(403);
  });

  it('crée, lit, met à jour, duplique et archive un modèle privé', async () => {
    const operator = await login(app, 'operateur');
    const created = await write(operator.agent, operator.csrf, 'post', '/api/syntheses/modeles', payload());
    expect(created.status).toBe(201);
    expect(created.body.item.portee).toBe('prive');
    expect(created.body.item.version).toBe(1);
    expect(created.body.item.est_proprietaire).toBe(true);
    expect(created.body.item.modifiable).toBe(true);
    expect(created.body.item.definition.sections).toHaveLength(1);
    const id = created.body.item.id;

    const detail = await operator.agent.get(`/api/syntheses/modeles/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.item.nom).toBe('Synthèse de test');

    const reader = await login(app, 'lecteur');
    expect((await reader.agent.get(`/api/syntheses/modeles/${id}`)).status).toBe(404);

    const updated = await write(operator.agent, operator.csrf, 'put', `/api/syntheses/modeles/${id}`, {
      ...payload({ nom: 'Synthèse modifiée', portee: 'equipe' }),
    });
    expect(updated.status).toBe(200);
    expect(updated.body.item.version).toBe(2);
    expect(updated.body.item.nom).toBe('Synthèse modifiée');
    expect(updated.body.item.portee).toBe('equipe');
    expect((await reader.agent.get(`/api/syntheses/modeles/${id}`)).status).toBe(200);

    const duplicated = await write(operator.agent, operator.csrf, 'post', `/api/syntheses/modeles/${id}/dupliquer`, {});
    expect(duplicated.status).toBe(201);
    expect(duplicated.body.item.nom).toBe('Copie de Synthèse modifiée');
    expect(duplicated.body.item.portee).toBe('prive');
    expect(duplicated.body.item.id).not.toBe(id);

    const archived = await write(operator.agent, operator.csrf, 'delete', `/api/syntheses/modeles/${id}`);
    expect(archived.status).toBe(204);
    expect((await operator.agent.get(`/api/syntheses/modeles/${id}`)).status).toBe(404);
    const after = await operator.agent.get('/api/syntheses/modeles');
    expect(after.body.items.some((item) => item.id === id)).toBe(false);
  });

  it('protège les modèles système : lecture, duplication, jamais modification', async () => {
    const definitionJson = JSON.stringify(definition);
    const systemId = Number(db.prepare(`INSERT INTO syntheses_modeles
      (nom, description, proprietaire_id, portee, definition_json, schema_version, cle_systeme)
      VALUES ('Système test', 'Lecture seule', NULL, 'systeme', ?, 1, 'systeme-test')`)
      .run(definitionJson).lastInsertRowid);

    const admin = await login(app, 'admin');
    const seen = await admin.agent.get(`/api/syntheses/modeles/${systemId}`);
    expect(seen.status).toBe(200);
    expect(seen.body.item.modifiable).toBe(false);

    expect((await write(admin.agent, admin.csrf, 'put', `/api/syntheses/modeles/${systemId}`, payload())).status).toBe(403);
    expect((await write(admin.agent, admin.csrf, 'delete', `/api/syntheses/modeles/${systemId}`)).status).toBe(403);

    const operator = await login(app, 'operateur');
    const copy = await write(operator.agent, operator.csrf, 'post', `/api/syntheses/modeles/${systemId}/dupliquer`, {});
    expect(copy.status).toBe(201);
    expect(copy.body.item.portee).toBe('prive');
    expect(copy.body.item.cle_systeme).toBeNull();
  });

  it('refuse une définition de plus de soixante blocs', async () => {
    const colonnes = Array.from({ length: 6 }, (_, column) => Array.from(
      { length: 11 },
      (_, index) => bloc(`bloc-${column}-${index}`),
    ));
    const { agent, csrf } = await login(app, 'operateur');
    const res = await write(agent, csrf, 'post', '/api/syntheses/modeles', payload({
      definition: { schema_version: 1, sections: [{ id: 'section-1', colonnes }] },
    }));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/60 blocs/);
  });

  it('journalise les actions de modèle', async () => {
    const actions = db.prepare(`SELECT action FROM audit_log
      WHERE action LIKE 'SYNTHESE_MODELE_%' ORDER BY id`).all().map((row) => row.action);
    expect(actions).toContain('SYNTHESE_MODELE_CREATION');
    expect(actions).toContain('SYNTHESE_MODELE_MODIFICATION');
    expect(actions).toContain('SYNTHESE_MODELE_DUPLICATION');
    expect(actions).toContain('SYNTHESE_MODELE_SUPPRESSION');
  });
});
