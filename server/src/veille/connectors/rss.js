import { z } from 'zod';
import { guardedGet } from '../http.js';
import { parseFeed } from './rssParse.js';

const MAX_ITEMS = 100;

const common = {
  maxItems: z.coerce.number().int().min(1).max(MAX_ITEMS).default(50),
};

function headersFor(curseur = {}) {
  const headers = {
    'User-Agent': 'ANM-Veille/7.0 (+plateforme interne Wilaya d\'Alger)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8',
  };
  if (curseur.etag) headers['If-None-Match'] = curseur.etag;
  if (curseur.last_modified) headers['If-Modified-Since'] = curseur.last_modified;
  return headers;
}

function mapper(raw, config) {
  return {
    id_externe: raw.id || raw.link || `${raw.title}|${raw.published || ''}`,
    url: raw.link || null,
    page_nom: (raw.feedTitle || config.nom || 'Flux RSS').slice(0, 200),
    texte: [raw.title, raw.summary].filter(Boolean).join('\n').slice(0, 10000),
    date_publication: raw.published || null,
    type_media: 'post',
  };
}

async function collectFeed(url, config, curseur, deps) {
  const response = await guardedGet(url, { headers: headersFor(curseur), ...deps });
  if (response.status === 304) return { elements: [], curseurSuivant: curseur, notModified: true };
  const feed = parseFeed(response.body);
  const elements = feed.items.slice(0, config.maxItems).map((item) => ({ ...item, feedTitle: feed.title }));
  return {
    elements,
    curseurSuivant: {
      etag: response.headers.get('etag') || curseur.etag || null,
      last_modified: response.headers.get('last-modified') || curseur.last_modified || null,
    },
    feed,
  };
}

async function tester(url, config, deps) {
  const result = await collectFeed(url, config, {}, deps);
  return { ok: true, titre: result.feed ? result.feed.title : null, nb_elements: result.elements.length };
}

export const rssConnector = {
  id: 'rss',
  type: 'rss',
  label: 'Flux RSS / Atom',
  schemaConfig: z.object({ url: z.string().trim().url().max(2000), ...common }).strict(),
  tester: ({ config, deps }) => tester(config.url, config, deps),
  collecter: ({ config, curseur = {}, deps }) => collectFeed(config.url, config, curseur, deps),
  mapper,
};

export function googleNewsUrl(config) {
  const query = String(config.query || '').trim();
  const params = new URLSearchParams({
    q: query,
    hl: config.hl || 'fr',
    gl: config.gl || 'DZ',
    ceid: config.ceid || 'DZ:fr',
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

export const googleNewsConnector = {
  id: 'google_news',
  type: 'google_news',
  label: 'Google Actualités par mots-clés',
  schemaConfig: z.object({
    query: z.string().trim().min(2).max(300),
    hl: z.string().trim().max(10).default('fr'),
    gl: z.string().trim().max(10).default('DZ'),
    ceid: z.string().trim().max(20).default('DZ:fr'),
    ...common,
  }).strict(),
  tester: ({ config, deps }) => tester(googleNewsUrl(config), config, deps),
  collecter: ({ config, curseur = {}, deps }) => collectFeed(googleNewsUrl(config), config, curseur, deps),
  mapper,
};
