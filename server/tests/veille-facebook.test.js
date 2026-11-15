import { describe, it, expect, beforeAll } from 'vitest';
import { freshDatabase } from './helpers.js';
import { encryptJson } from '../src/veille/secrets.js';
import { collectSource } from '../src/veille/collect.js';
import {
  facebookManagedConnector, graphError, mapFacebook,
} from '../src/veille/connectors/facebook.js';

const lookupImpl = async () => [{ address: '157.240.1.35', family: 4 }];

let db;

beforeAll(() => { ({ db } = freshDatabase()); });

function fakeGraph(handler) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    const result = handler(new URL(url)) || {};
    return new Response(JSON.stringify(result.body ?? {}), { status: result.status || 200 });
  };
  return { fetchImpl, calls };
}

function source(config, overrides = {}) {
  return Number(db.prepare(`INSERT INTO veille_sources(type, nom, config_chiffree, actif, frequence_min)
    VALUES (?, ?, ?, ?, ?)`).run(
    overrides.type || 'facebook_page_geree', overrides.nom || 'Page Facebook test', encryptJson(config),
    overrides.actif ?? 1, overrides.frequence_min ?? 30,
  ).lastInsertRowid);
}

const CONFIG = {
  page_id: '123456', page_token: 'EAAB-test-token-123', page_nom: 'Page Alger',
  include_comments: true, include_tagged: true, max_posts: 10, max_comments: 10,
};

const feedPage = (after) => ({
  data: [{
    id: 'post_1', message: 'Nid de poule à Alger Centre', created_time: '2026-11-10T08:00:00+0000',
    permalink_url: 'https://facebook.com/page/posts/1', from: { name: 'Page Alger' },
    reactions: { summary: { total_count: 12 } }, comments: { summary: { total_count: 2 } },
    place: { location: { latitude: 36.7538, longitude: 3.0588 } },
  }],
  paging: after
    ? { cursors: { after }, next: `https://graph.facebook.com/next?after=${after}` }
    : { cursors: { after: 'SAME' } },
});

const commentsPage = {
  data: [{
    id: 'comment_1', message: 'Toujours pas réparé', created_time: '2026-11-10T09:00:00+0000',
    permalink_url: 'https://facebook.com/page/posts/1?comment=1', from: { name: 'Citoyen A' },
  }],
};

const taggedPage = {
  data: [{
    id: 'tag_1', message: 'Déchets devant l’école de Bab El Oued', created_time: '2026-11-10T10:00:00+0000',
    permalink_url: 'https://facebook.com/page/tagged/1', from: { name: 'Habitant' },
  }],
  paging: { cursors: { after: 'TAG1' }, next: 'https://graph.facebook.com/tagged-next' },
};

describe('Connecteur Facebook — collecte et curseurs', () => {
  it('collecte publications, commentaires et mentions avec métriques et GPS', async () => {
    const sourceId = source(CONFIG);
    const fake = fakeGraph((url) => {
      if (/\/feed$/.test(url.pathname)) return { body: feedPage('CURSOR1') };
      if (/\/comments$/.test(url.pathname)) return { body: commentsPage };
      if (/\/tagged$/.test(url.pathname)) return { body: taggedPage };
      return { status: 404, body: { error: { code: 100, message: 'inconnu' } } };
    });
    const result = await collectSource(db, { source_id: sourceId }, {
      fetchImpl: fake.fetchImpl, lookupImpl, graphBaseUrl: 'https://graph.facebook.com',
    });
    expect(result).toMatchObject({ collected: 3, newCount: 3 });
    const rows = db.prepare('SELECT * FROM veille_elements WHERE source_id = ? ORDER BY id').all(sourceId);
    expect(rows.map((row) => row.type_media).sort()).toEqual(['comment', 'post', 'tag']);
    const post = rows.find((row) => row.id_externe === 'post_1');
    expect(post.gps_lat).toBeCloseTo(36.7538);
    expect(post.gps_lng).toBeCloseTo(3.0588);
    expect(JSON.parse(post.metriques_json)).toMatchObject({ reactions: 12, commentaires: 2 });
    const cursor = JSON.parse(db.prepare('SELECT curseur FROM veille_sources WHERE id = ?').get(sourceId).curseur);
    expect(cursor).toMatchObject({ after: 'CURSOR1', tagged_after: 'TAG1' });
  });

  it('reprend la pagination avec le curseur après mémorisé et ne recrée pas de doublon', async () => {
    const sourceId = source(CONFIG);
    const fake = fakeGraph((url) => {
      if (/\/feed$/.test(url.pathname)) return { body: feedPage(url.searchParams.get('after') ? 'CURSOR2' : 'CURSOR1') };
      if (/\/comments$/.test(url.pathname)) return { body: commentsPage };
      if (/\/tagged$/.test(url.pathname)) return { body: taggedPage };
      return { status: 404, body: { error: { code: 100, message: 'inconnu' } } };
    });
    const deps = { fetchImpl: fake.fetchImpl, lookupImpl, graphBaseUrl: 'https://graph.facebook.com' };
    await collectSource(db, { source_id: sourceId }, deps);
    await collectSource(db, { source_id: sourceId }, deps);
    const feedCalls = fake.calls.filter((value) => new URL(value).pathname.endsWith('/feed'));
    expect(feedCalls).toHaveLength(2);
    expect(feedCalls[0]).not.toContain('after=');
    expect(feedCalls[1]).toContain('after=CURSOR1');
    expect(db.prepare('SELECT COUNT(*) AS c FROM veille_elements WHERE source_id = ?').get(sourceId).c).toBe(3);
  });

  it('respecte la désactivation des commentaires et des mentions sans requête inutile', async () => {
    const sourceId = source({ ...CONFIG, include_comments: false, include_tagged: false });
    const fake = fakeGraph((url) => {
      if (/\/feed$/.test(url.pathname)) return { body: { data: feedPage('').data, paging: {} } };
      return { status: 500, body: { error: { code: 1, message: 'ne doit pas être appelé' } } };
    });
    const result = await collectSource(db, { source_id: sourceId }, {
      fetchImpl: fake.fetchImpl, lookupImpl, graphBaseUrl: 'https://graph.facebook.com',
    });
    expect(result).toMatchObject({ collected: 1, newCount: 1 });
    const paths = fake.calls.map((value) => new URL(value).pathname);
    expect(paths.some((pathname) => pathname.endsWith('/comments') || pathname.endsWith('/tagged'))).toBe(false);
    const cursor = JSON.parse(db.prepare('SELECT curseur FROM veille_sources WHERE id = ?').get(sourceId).curseur);
    expect(cursor).toMatchObject({ after: null, tagged_after: null });
  });
});

describe('Connecteur Facebook — erreurs Graph typées', () => {
  const cases = [
    [401, 190, 'JETON_EXPIRE'],
    [400, 4, 'LIMITE_DEBIT'],
    [403, 10, 'PERMISSION_MANQUANTE'],
    [403, 250, 'PERMISSION_MANQUANTE'],
    [404, 100, 'PAGE_INTROUVABLE'],
  ];

  it.each(cases)('mappe le statut %i et le code %i vers %s', (status, code, expected) => {
    expect(graphError({ code, message: 'erreur test' }, status).code).toBe(expected);
  });

  it('remonte une erreur de jeton sans masquer la cause', async () => {
    const sourceId = source(CONFIG);
    const fake = fakeGraph(() => ({ status: 401, body: { error: { code: 190, message: 'Session expirée' } } }));
    await expect(collectSource(db, { source_id: sourceId }, {
      fetchImpl: fake.fetchImpl, lookupImpl, graphBaseUrl: 'https://graph.facebook.com',
    })).rejects.toMatchObject({ code: 'JETON_EXPIRE' });
  });

  it('remonte une permission manquante pour une page publique', async () => {
    const sourceId = source(CONFIG, { type: 'facebook_page_publique' });
    const fake = fakeGraph(() => ({ status: 403, body: { error: { code: 10, message: 'Page Public Content Access requis' } } }));
    await expect(collectSource(db, { source_id: sourceId }, {
      fetchImpl: fake.fetchImpl, lookupImpl, graphBaseUrl: 'https://graph.facebook.com',
    })).rejects.toMatchObject({ code: 'PERMISSION_MANQUANTE' });
  });
});

describe('Connecteur Facebook — mapping et validation', () => {
  it('mapper commentaire et publication, sans inventer d’auteur', () => {
    const comment = mapFacebook({ _type: 'comment', id: 'c1', message: 'Merci', permalink_url: 'https://fb/c1' }, CONFIG);
    expect(comment).toMatchObject({ id_externe: 'c1', url: 'https://fb/c1', type_media: 'comment', auteur: null });
    const post = mapFacebook({
      _type: 'post', id: 'p1', story: 'Photo partagée', created_time: '2026-11-10T08:00:00+0000',
    }, CONFIG);
    expect(post).toMatchObject({ id_externe: 'p1', texte: 'Photo partagée', type_media: 'post' });
  });

  it('parse les booléens textuels et borne la configuration', () => {
    const config = facebookManagedConnector.schemaConfig.parse({
      page_id: '1', page_token: '1234567890', include_comments: 'false', include_tagged: '1',
    });
    expect(config.include_comments).toBe(false);
    expect(config.include_tagged).toBe(true);
    expect(config.api_version).toBe('v21.0');
    expect(() => facebookManagedConnector.schemaConfig.parse({ page_id: '1' })).toThrow();
  });

  it('teste une page gérée et renvoie son nom public', async () => {
    const fake = fakeGraph((url) => {
      if (url.pathname === '/v21.0/123456') return { body: { id: '123456', name: 'Wilaya d’Alger' } };
      return { status: 404, body: { error: { code: 100, message: 'inconnu' } } };
    });
    const result = await facebookManagedConnector.tester({
      config: facebookManagedConnector.schemaConfig.parse(CONFIG),
      deps: { fetchImpl: fake.fetchImpl, lookupImpl, graphBaseUrl: 'https://graph.facebook.com' },
    });
    expect(result).toMatchObject({ ok: true, page: { id: '123456', nom: 'Wilaya d’Alger' } });
  });
});
