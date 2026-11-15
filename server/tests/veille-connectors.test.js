import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { freshDatabase, login, write } from './helpers.js';
import { encryptJson } from '../src/veille/secrets.js';
import { collectSource } from '../src/veille/collect.js';
import { googleNewsUrl, rssConnector } from '../src/veille/connectors/rss.js';
import { parseFeed } from '../src/veille/connectors/rssParse.js';
import { ensureVeilleJobs } from '../src/veille/scheduler.js';
import { collectNow, listSources } from '../src/veille/sources.js';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Actualités Alger Test</title>
  <item>
    <title>Fuite d'eau rue Didouche Mourad</title>
    <link>https://exemple.dz/articles/1</link>
    <guid>article-1</guid>
    <description><![CDATA[Une fuite d'eau importante à Alger Centre.]]></description>
    <pubDate>Mon, 09 Nov 2026 08:00:00 GMT</pubDate>
  </item>
  <item>
    <title><![CDATA[Déchets accumulés à Bab El Oued]]></title>
    <link>https://exemple.dz/articles/2</link>
    <guid>article-2</guid>
    <description>Les habitants signalent des dépôts sauvages.</description>
    <pubDate>Mon, 09 Nov 2026 09:30:00 GMT</pubDate>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Flux Atom test</title>
  <entry>
    <title>Lampadaire en panne</title>
    <link rel="alternate" href="https://exemple.dz/atom/1"/>
    <id>atom-1</id>
    <summary>Éclairage public hors service depuis trois jours.</summary>
    <updated>2026-11-10T07:00:00Z</updated>
  </entry>
</feed>`;

const lookupImpl = async () => [{ address: '93.184.216.34', family: 4 }];
const okFetch = (body, headers = {}) => async () => new Response(body, { status: 200, headers });

let app; let db; let admin; let operator;

beforeAll(async () => {
  ({ db } = freshDatabase());
  app = createApp();
  admin = await login(app, 'admin');
  operator = await login(app, 'operateur');
  db.prepare("UPDATE parametres SET valeur = '1' WHERE cle = 'veille_activee'").run();
});

function insertSource(config, overrides = {}) {
  return Number(db.prepare(`INSERT INTO veille_sources(type, nom, config_chiffree, actif, frequence_min)
    VALUES (?, ?, ?, ?, ?)`).run(
    overrides.type || 'rss', overrides.nom || 'Flux de test', encryptJson(config),
    overrides.actif ?? 1, overrides.frequence_min ?? 30,
  ).lastInsertRowid);
}

describe('Analyse RSS / Atom', () => {
  it('extrait les éléments RSS, CDATA et dates', () => {
    const feed = parseFeed(RSS);
    expect(feed.title).toBe('Actualités Alger Test');
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]).toMatchObject({ id: 'article-1', link: 'https://exemple.dz/articles/1' });
    expect(feed.items[0].summary).toContain("fuite d'eau");
    expect(feed.items[0].published).toBe('2026-11-09T08:00:00.000Z');
    expect(feed.items[1].title).toBe('Déchets accumulés à Bab El Oued');
  });

  it('extrait un flux Atom et son lien alternatif', () => {
    const feed = parseFeed(ATOM);
    expect(feed.title).toBe('Flux Atom test');
    expect(feed.items[0]).toMatchObject({ id: 'atom-1', link: 'https://exemple.dz/atom/1', title: 'Lampadaire en panne' });
  });

  it('rejette un document qui n’est pas un flux', () => {
    expect(() => parseFeed('<html><body>maintenance</body></html>')).toThrowError(/RSS\/Atom/);
    expect(() => parseFeed('')).toThrowError(/vide/);
  });

  it('construit une requête Google Actualités paramétrée', () => {
    const url = new URL(googleNewsUrl({ query: 'fuite eau Alger', hl: 'ar', gl: 'DZ', ceid: 'DZ:ar' }));
    expect(url.origin).toBe('https://news.google.com');
    expect(url.pathname).toBe('/rss/search');
    expect(url.searchParams.get('q')).toBe('fuite eau Alger');
    expect(url.searchParams.get('hl')).toBe('ar');
    expect(url.searchParams.get('ceid')).toBe('DZ:ar');
  });
});

describe('Collecte RSS — idempotence, curseur et erreurs typées', () => {
  it('collecte, analyse puis ne recrée aucun doublon au rejeu', async () => {
    const sourceId = insertSource({ url: 'https://exemple.dz/feed.xml', maxItems: 10 });
    const job = { source_id: sourceId };
    const first = await collectSource(db, job, { fetchImpl: okFetch(RSS, { etag: '"v1"' }), lookupImpl });
    expect(first.collected).toBe(2);
    expect(first.newCount).toBe(2);
    const remaining = db.prepare('SELECT COUNT(*) AS c FROM veille_elements WHERE source_id = ?').get(sourceId).c;
    expect(remaining).toBe(2);
    expect(JSON.parse(db.prepare('SELECT curseur FROM veille_sources WHERE id = ?').get(sourceId).curseur).etag).toBe('"v1"');

    const second = await collectSource(db, job, { fetchImpl: okFetch(RSS, { etag: '"v1"' }), lookupImpl });
    expect(second.newCount).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS c FROM veille_elements WHERE source_id = ?').get(sourceId).c).toBe(2);
  });

  it('gère un 304 sans créer d’élément', async () => {
    const sourceId = insertSource({ url: 'https://exemple.dz/feed.xml' });
    let sentHeaders = null;
    const fetchImpl = async (_url, options) => { sentHeaders = options.headers; return new Response(null, { status: 304 }); };
    const result = await collectSource(db, { source_id: sourceId }, {
      fetchImpl, lookupImpl,
    });
    expect(result).toMatchObject({ collected: 0, newCount: 0, notModified: true });
    expect(sentHeaders['If-None-Match']).toBeUndefined();
  });

  it('signale un XML invalide sans planter la collecte', async () => {
    const sourceId = insertSource({ url: 'https://exemple.dz/feed.xml' });
    await expect(collectSource(db, { source_id: sourceId }, { fetchImpl: okFetch('<html>erreur</html>'), lookupImpl }))
      .rejects.toMatchObject({ code: 'XML_INVALIDE' });
  });

  it('borne la taille de réponse et le nombre d’éléments', async () => {
    const bigId = insertSource({ url: 'https://exemple.dz/big.xml' });
    await expect(collectSource(db, { source_id: bigId }, {
      fetchImpl: okFetch('x'.repeat(2 * 1024 * 1024 + 1)), lookupImpl,
    })).rejects.toMatchObject({ code: 'TROP_VOLUMINEUX' });

    const limitedId = insertSource({ url: 'https://exemple.dz/feed.xml', maxItems: 1 });
    const result = await collectSource(db, { source_id: limitedId }, { fetchImpl: okFetch(RSS), lookupImpl });
    expect(result.collected).toBe(1);
  });

  it('conserve le curseur ETag reçu', async () => {
    const sourceId = insertSource({ url: 'https://exemple.dz/feed.xml' });
    await collectSource(db, { source_id: sourceId }, { fetchImpl: okFetch(RSS, { etag: '"abc"' }), lookupImpl });
    const cursor = JSON.parse(db.prepare('SELECT curseur FROM veille_sources WHERE id = ?').get(sourceId).curseur);
    expect(cursor.etag).toBe('"abc"');
  });

  it('utilise un mapping minimal et conserve le texte public', async () => {
    const mapped = rssConnector.mapper({ id: 'x', title: 'Titre', summary: 'Résumé', link: 'https://exemple.dz/x' }, { nom: 'Flux' });
    expect(mapped).toMatchObject({ id_externe: 'x', url: 'https://exemple.dz/x', texte: 'Titre\nRésumé' });
    expect(mapped.page_nom).toBe('Flux');
  });
});

describe('Sources — CRUD, masquage et collecte à la demande', () => {
  it('crée une source, chiffre sa configuration et ne la renvoie jamais en clair', async () => {
    const res = await write(admin.agent, admin.csrf, 'post', '/api/veille/sources', {
      type: 'rss', nom: 'Flux presse locale', frequence_min: 45,
      config: { url: 'https://exemple.dz/presse.xml' },
    });
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ type: 'rss', nom: 'Flux presse locale', frequence_min: 45 });
    expect(res.body.item.config_chiffree).toBeUndefined();
    expect(res.body.item.config_masquee.url).toBe('https://exemple.dz/presse.xml');
    const row = db.prepare('SELECT config_chiffree FROM veille_sources WHERE id = ?').get(res.body.item.id);
    expect(row.config_chiffree.startsWith('v1:')).toBe(true);
    expect(row.config_chiffree).not.toContain('exemple.dz');
  });

  it('masque les jetons des sources Facebook', async () => {
    const res = await write(admin.agent, admin.csrf, 'post', '/api/veille/sources', {
      type: 'facebook_page_geree', nom: 'Page officielle',
      config: { page_id: '123456', page_token: 'EAAB-secret-token', page_nom: 'Page officielle' },
    });
    expect(res.status).toBe(201);
    expect(res.body.item.config_masquee).toMatchObject({ page_id: '123456', page_token: '••••••••' });
  });

  it('réserve la configuration à l’administrateur et la modifie sans fuite', async () => {
    const created = await write(admin.agent, admin.csrf, 'post', '/api/veille/sources', {
      type: 'rss', nom: 'Flux opérateur', config: { url: 'https://exemple.dz/op.xml' },
    });
    const asOperator = await operator.agent.get('/api/veille/sources');
    expect(asOperator.status).toBe(200);
    const hidden = asOperator.body.items.find((row) => row.id === created.body.item.id);
    expect(hidden.config_masquee).toBeUndefined();
    expect(hidden.connecteur_disponible).toBe(true);

    const patched = await write(admin.agent, admin.csrf, 'patch', `/api/veille/sources/${created.body.item.id}`, {
      nom: 'Flux renommé', frequence_min: 60, actif: 0,
    });
    expect(patched.status).toBe(200);
    expect(patched.body.item).toMatchObject({ nom: 'Flux renommé', frequence_min: 60, actif: 0 });
    expect(patched.body.item.config_chiffree).toBeUndefined();
    expect(JSON.stringify(patched.body)).not.toContain('v1:');
  });

  it('refuse une configuration invalide et une fréquence hors bornes', async () => {
    const badUrl = await write(admin.agent, admin.csrf, 'post', '/api/veille/sources', {
      type: 'rss', nom: 'Flux invalide', config: { url: 'pas une url' },
    });
    expect(badUrl.status).toBe(400);
    const badFrequency = await write(admin.agent, admin.csrf, 'post', '/api/veille/sources', {
      type: 'rss', nom: 'Flux rapide', frequence_min: 2, config: { url: 'https://exemple.dz/x.xml' },
    });
    expect(badFrequency.status).toBe(400);
  });

  it('supprime une source et refuse ensuite son accès', async () => {
    const created = await write(admin.agent, admin.csrf, 'post', '/api/veille/sources', {
      type: 'rss', nom: 'Flux jetable', config: { url: 'https://exemple.dz/jetable.xml' },
    });
    const removed = await write(admin.agent, admin.csrf, 'delete', `/api/veille/sources/${created.body.item.id}`);
    expect(removed.status).toBe(204);
    const runs = await admin.agent.get(`/api/veille/sources/${created.body.item.id}/runs`);
    expect(runs.body.items).toEqual([]);
  });

  it('collecte à la demande, enregistre le passage et reste idempotent', async () => {
    const sourceId = insertSource({ url: 'https://exemple.dz/feed.xml' });
    ensureVeilleJobs(db);
    const first = await collectNow(db, sourceId, { fetchImpl: okFetch(RSS), lookupImpl });
    expect(first).toMatchObject({ ok: true, newCount: 2 });
    const job = db.prepare('SELECT * FROM veille_jobs WHERE source_id = ?').get(sourceId);
    expect(job.statut).toBe('success');
    const runs = db.prepare('SELECT * FROM veille_job_runs WHERE source_id = ?').all(sourceId);
    expect(runs.length).toBe(1);
    const second = await collectNow(db, sourceId, { fetchImpl: okFetch(RSS), lookupImpl });
    expect(second.newCount).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS c FROM veille_job_runs WHERE source_id = ?').get(sourceId).c).toBe(2);
    const row = listSources(db, { admin: true }).find((item) => item.id === sourceId);
    expect(row).toMatchObject({ elements: 2 });
  });

  it('enregistre un échec typé sans laisser la source en succès', async () => {
    const sourceId = insertSource({ url: 'https://exemple.dz/feed.xml' });
    ensureVeilleJobs(db);
    const result = await collectNow(db, sourceId, { fetchImpl: okFetch('<html>ko</html>'), lookupImpl });
    expect(result).toMatchObject({ ok: false, code: 'XML_INVALIDE' });
    const job = db.prepare('SELECT * FROM veille_jobs WHERE source_id = ?').get(sourceId);
    expect(job.statut).toBe('backoff');
    expect(job.erreur_code).toBe('XML_INVALIDE');
    expect(job.tentatives).toBe(1);
  });

  it('expose le catalogue des connecteurs disponibles', async () => {
    const res = await request(app).get('/api/veille/sources').set('Cookie', '');
    expect(res.status).toBe(401);
    const auth = await admin.agent.get('/api/veille/sources');
    expect(auth.body.connecteurs.map((item) => item.type).sort()).toEqual([
      'facebook_page_geree', 'facebook_page_publique', 'google_news', 'import', 'rss',
    ]);
  });
});
