import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../src/app.js';
import { ensureSystemModels } from '../src/synthese/systemModels.js';
import { freshDatabase, login, write } from './helpers.js';

let app;
let db;

beforeAll(() => {
  ({ db } = freshDatabase());
  ensureSystemModels(db);
  app = createApp();
});

describe('V19 — numérotation officielle et charte', () => {
  it('alloue une séquence annuelle monotone et non réutilisée', async () => {
    const { agent, csrf } = await login(app, 'operateur');
    const un = await write(agent, csrf, 'post', '/api/syntheses/numero', { annee: '2026' });
    expect(un.status).toBe(200);
    expect(un.body.item.reference).toBe('N° 0001/CW/2026');
    const deux = await write(agent, csrf, 'post', '/api/syntheses/numero', { annee: '2026' });
    expect(deux.body.item.sequence).toBe(un.body.item.sequence + 1);
    expect(deux.body.item.reference).not.toBe(un.body.item.reference);
    const autreAnnee = await write(agent, csrf, 'post', '/api/syntheses/numero', { annee: '2027' });
    expect(autreAnnee.body.item.reference).toBe('N° 0001/CW/2027');
    const direct = db.prepare('SELECT sequence FROM synthese_numeros WHERE annee = ?').get('2026');
    expect(direct.sequence).toBe(2);
  });

  it('refuse une année invalide et un motif sans séquence', async () => {
    const { agent, csrf } = await login(app, 'operateur');
    expect((await write(agent, csrf, 'post', '/api/syntheses/numero', { annee: '26' })).status).toBe(400);
    expect((await write(agent, csrf, 'post', '/api/syntheses/numero', { motif: 'REF' })).status).toBe(200);
  });

  it('réserve le verrou de charte aux administrateurs et trace le déverrouillage', async () => {
    const lecteur = await login(app, 'lecteur');
    expect((await write(lecteur.agent, lecteur.csrf, 'patch', '/api/syntheses/charte', { verrouille: false })).status).toBe(403);
    const admin = await login(app, 'admin');
    const avant = await admin.agent.get('/api/syntheses/charte');
    expect(avant.status).toBe(200);
    expect(avant.body.item.verrouille).toBe(true);
    expect(avant.body.item.palette).toHaveLength(5);
    const apres = await write(admin.agent, admin.csrf, 'patch', '/api/syntheses/charte', { verrouille: false });
    expect(apres.status).toBe(200);
    expect(apres.body.item.verrouille).toBe(false);
    const trace = db.prepare("SELECT action FROM audit_log WHERE action = 'SYNTHESE_CHARTE_MODIFICATION' ORDER BY id DESC LIMIT 1").get();
    expect(trace).toBeTruthy();
  });

  it('limite la palette de la charte à cinq couleurs', async () => {
    const { agent, csrf } = await login(app, 'admin');
    const bad = await write(agent, csrf, 'patch', '/api/syntheses/charte', { palette: ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'] });
    expect(bad.status).toBe(400);
  });

  it('réserve la liste blanche des sources à l’administrateur', async () => {
    const lecteur = await login(app, 'lecteur');
    expect((await write(lecteur.agent, lecteur.csrf, 'post', '/api/syntheses/sources', { domaine: 'exemple.dz' })).status).toBe(403);
    const admin = await login(app, 'admin');
    const ajout = await write(admin.agent, admin.csrf, 'post', '/api/syntheses/sources', { domaine: 'https://exemple.dz/chemin' });
    expect(ajout.status).toBe(201);
    expect(ajout.body.item.domaine).toBe('exemple.dz');
    const liste = await admin.agent.get('/api/syntheses/sources');
    expect(liste.body.items.some((item) => item.domaine === 'exemple.dz')).toBe(true);
    const retrait = await write(admin.agent, admin.csrf, 'delete', `/api/syntheses/sources/${ajout.body.item.id}`);
    expect(retrait.status).toBe(200);
    expect(retrait.body.items.some((item) => item.domaine === 'exemple.dz')).toBe(false);
  });
});

describe('V19 — gabarits système', () => {
  it('expose six gabarits modifiables A4/A5', async () => {
    const { agent } = await login(app, 'admin');
    const res = await agent.get('/api/syntheses/modeles');
    expect(res.status).toBe(200);
    const gabarits = res.body.items.filter((item) => String(item.cle_systeme || '').startsWith('v19-'));
    expect(gabarits).toHaveLength(6);
    for (const gabarit of gabarits) {
      expect(gabarit.portee).toBe('systeme');
      expect(gabarit.definition?.meta?.gabarit).toBe(true);
      expect(gabarit.definition?.meta?.formats).toEqual(['a5', 'a4']);
    }
  });
});
