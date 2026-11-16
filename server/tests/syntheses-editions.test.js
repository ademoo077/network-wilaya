import { describe, expect, it, beforeAll } from 'vitest';
import { todayAlgiers } from '@anm/shared';
import { createApp } from '../src/app.js';
import { createAnomalie } from '../src/services/anomalies.js';
import { ensureSystemModels } from '../src/synthese/systemModels.js';
import { resolveEditionPeriod } from '../src/services/synthesesEditions.js';
import { freshDatabase, login, write } from './helpers.js';

let app;
let db;
let refs;
let userIds;
let sourceId;

const TODAY = todayAlgiers();

function textBlock(id) {
  return { id, type: 'texte', options: { texte_fr: 'Bloc de test', texte_ar: 'كتلة اختبار' } };
}

function binaryParser(res, callback) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

beforeAll(() => {
  ({ db, refs, userIds } = freshDatabase());
  ensureSystemModels(db);
  createAnomalie(db, {
    lien_url: 'https://www.facebook.com/anm/synthese/edition-1',
    date_signalement: TODAY,
    domaine_id: refs.domaineId,
    type_id: refs.typeId,
    daira_id: refs.dairaId,
    commune_id: refs.communeId,
    adresse_texte: 'Rue de test',
  }, userIds.admin, { today: TODAY });
  sourceId = db.prepare("SELECT id FROM syntheses_modeles WHERE cle_systeme = 'hebdomadaire'").get().id;
  app = createApp();
});

describe('période d’édition', () => {
  it('résout semaine, mois, glissant et plage', () => {
    const semaine = resolveEditionPeriod(db, { mode: 'semaine' });
    expect(semaine.debut <= semaine.fin).toBe(true);
    expect(semaine.mode).toBe('semaine');
    const mois = resolveEditionPeriod(db, { mode: 'mois' });
    expect(mois.debut.endsWith('-01')).toBe(true);
    const glissant = resolveEditionPeriod(db, { mode: 'glissant', jours: 7 });
    expect(glissant.debut < glissant.fin).toBe(true);
    const plage = resolveEditionPeriod(db, { mode: 'plage', debut: '2026-01-01', fin: '2026-01-31' });
    expect(plage).toEqual({ mode: 'plage', debut: '2026-01-01', fin: '2026-01-31' });
  });

  it('refuse une plage inversée ou incomplète', () => {
    expect(() => resolveEditionPeriod(db, { mode: 'plage', debut: '2026-02-01', fin: '2026-01-01' })).toThrow();
    expect(() => resolveEditionPeriod(db, { mode: 'plage' })).toThrow();
  });
});

describe('copy-on-write et retour au modèle standard', () => {
  it('crée une seule fois « Ma synthèse hebdomadaire »', async () => {
    const { agent, csrf } = await login(app, 'operateur');
    const first = await write(agent, csrf, 'post', `/api/syntheses/modeles/${sourceId}/personnaliser`);
    expect(first.status).toBe(201);
    expect(first.body.created).toBe(true);
    expect(first.body.item.nom).toBe('Ma synthèse hebdomadaire');
    expect(first.body.item.portee).toBe('prive');
    expect(first.body.item.est_proprietaire).toBe(true);
    expect(first.body.item.modifiable).toBe(true);
    const second = await write(agent, csrf, 'post', `/api/syntheses/modeles/${sourceId}/personnaliser`);
    expect(second.status).toBe(200);
    expect(second.body.created).toBe(false);
    expect(second.body.item.id).toBe(first.body.item.id);
  });

  it('rejette une mise à jour obsolète puis restaure le modèle standard', async () => {
    const { agent, csrf } = await login(app, 'operateur');
    const copy = (await write(agent, csrf, 'post', `/api/syntheses/modeles/${sourceId}/personnaliser`)).body.item;
    const stale = await write(agent, csrf, 'put', `/api/syntheses/modeles/${copy.id}`, {
      nom: copy.nom, definition: copy.definition, version: copy.version + 5,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('SYNTHESE_VERSION_CONFLIT');
    const definition = JSON.parse(JSON.stringify(copy.definition));
    definition.sections[0].colonnes[0].push(textBlock('bloc-texte-test'));
    const updated = await write(agent, csrf, 'put', `/api/syntheses/modeles/${copy.id}`, {
      nom: copy.nom, definition, version: copy.version,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.item.version).toBe(copy.version + 1);
    const reset = await write(agent, csrf, 'post', `/api/syntheses/modeles/${copy.id}/reinitialiser`, { source_id: sourceId });
    expect(reset.status).toBe(200);
    expect(reset.body.source).toBe(sourceId);
    expect(reset.body.item.definition).toEqual(copy.definition);
    expect(reset.body.item.version).toBe(copy.version + 2);
  });

  it('refuse la personnalisation et la génération à un lecteur', async () => {
    const { agent, csrf } = await login(app, 'lecteur');
    expect((await write(agent, csrf, 'post', `/api/syntheses/modeles/${sourceId}/personnaliser`)).status).toBe(403);
    expect((await write(agent, csrf, 'post', '/api/syntheses/editions', {
      modele_id: sourceId, periode: { mode: 'semaine' },
    })).status).toBe(403);
  });
});

describe('éditions figées', () => {
  it('génère, fige et conserve la version 1 lors d’une re-génération', async () => {
    const { agent, csrf } = await login(app, 'operateur');
    const created = await write(agent, csrf, 'post', '/api/syntheses/editions', {
      modele_id: sourceId, periode: { mode: 'semaine' },
    });
    expect(created.status).toBe(201);
    const edition = created.body.item;
    expect(edition.statut).toBe('brouillon');
    expect(edition.version).toBe(1);
    expect(edition.a_snapshot).toBe(true);
    expect(edition.snapshot.blocs.length).toBeGreaterThan(0);
    expect(edition.snapshot.blocs.some((bloc) => bloc.resultat)).toBe(true);
    expect(edition.snapshot.periode.debut).toBe(edition.periode.debut);
    const frozen = await write(agent, csrf, 'post', `/api/syntheses/editions/${edition.id}/figer`);
    expect(frozen.status).toBe(200);
    expect(frozen.body.item.statut).toBe('fige');
    expect(frozen.body.item.figee_le).toBeTruthy();
    const again = await write(agent, csrf, 'post', `/api/syntheses/editions/${edition.id}/figer`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('SYNTHESE_EDITION_FIGEE');
    const second = await write(agent, csrf, 'post', '/api/syntheses/editions', {
      modele_id: sourceId, periode: { mode: 'semaine' },
    });
    expect(second.status).toBe(201);
    expect(second.body.item.version).toBe(2);
    const firstAgain = await agent.get(`/api/syntheses/editions/${edition.id}`);
    expect(firstAgain.status).toBe(200);
    expect(firstAgain.body.item.statut).toBe('fige');
    expect(firstAgain.body.item.snapshot.blocs.length).toBe(edition.snapshot.blocs.length);
  });

  it('ignore les modifications du modèle après le figeage', async () => {
    const { agent, csrf } = await login(app, 'operateur');
    const copy = (await write(agent, csrf, 'post', `/api/syntheses/modeles/${sourceId}/personnaliser`)).body.item;
    const created = await write(agent, csrf, 'post', '/api/syntheses/editions', {
      modele_id: copy.id, periode: { mode: 'plage', debut: '2026-11-02', fin: '2026-11-08' },
    });
    expect(created.status).toBe(201);
    const edition = created.body.item;
    const before = edition.snapshot.blocs.length;
    await write(agent, csrf, 'post', `/api/syntheses/editions/${edition.id}/figer`);
    const definition = JSON.parse(JSON.stringify(copy.definition));
    definition.sections[0].colonnes[0].push(textBlock('bloc-apres-figeage'));
    const updated = await write(agent, csrf, 'put', `/api/syntheses/modeles/${copy.id}`, {
      nom: copy.nom, definition, version: copy.version,
    });
    expect(updated.status).toBe(200);
    const reread = await agent.get(`/api/syntheses/editions/${edition.id}`);
    expect(reread.body.item.snapshot.blocs.length).toBe(before);
    expect(JSON.stringify(reread.body.item.snapshot)).not.toContain('bloc-apres-figeage');
  });

  it('liste les éditions visibles et exporte un classeur Excel par widget', async () => {
    const { agent } = await login(app, 'admin');
    const list = await agent.get('/api/syntheses/editions');
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThan(0);
    expect(list.body.items.every((item) => item.snapshot === null)).toBe(true);
    const filtered = await agent.get(`/api/syntheses/editions?modele_id=${sourceId}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.items.every((item) => item.modele_id === sourceId)).toBe(true);
    const id = list.body.items[0].id;
    const res = await agent.get(`/api/syntheses/editions/${id}/export.xlsx`).buffer(true).parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('.xlsx');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(100);
  });
});
