import { z } from 'zod';
import { ConnectorError, guardedGet } from '../http.js';

const DEFAULT_VERSION = 'v21.0';

const POST_FIELDS = [
  'id', 'message', 'story', 'created_time', 'permalink_url', 'from', 'place',
  'shares', 'reactions.limit(0).summary(true)', 'comments.limit(0).summary(true)',
].join(',');

const COMMENT_FIELDS = ['id', 'message', 'created_time', 'permalink_url', 'from', 'parent{id}'].join(',');
const TAG_FIELDS = 'id,message,story,created_time,permalink_url,from,place';

const boolConfig = z.union([z.boolean(), z.enum(['0', '1', 'true', 'false', 'oui', 'non'])])
  .transform((value) => (typeof value === 'boolean' ? value : ['1', 'true', 'oui'].includes(value)))
  .default(true);

const configShape = {
  page_id: z.string().trim().min(1).max(100),
  page_token: z.string().trim().min(10).max(2000),
  page_nom: z.string().trim().max(200).optional(),
  api_version: z.string().trim().regex(/^v\d{1,2}\.\d+$/).default(DEFAULT_VERSION),
  include_comments: boolConfig,
  include_tagged: boolConfig,
  max_posts: z.coerce.number().int().min(1).max(50).default(15),
  max_comments: z.coerce.number().int().min(0).max(50).default(10),
};

function graphBase(deps = {}) {
  return String(deps.graphBaseUrl || 'https://graph.facebook.com').replace(/\/+$/, '');
}

export function graphUrl(config, path, params = {}, deps = {}) {
  const version = config.api_version || DEFAULT_VERSION;
  const url = new URL(`${graphBase(deps)}/${version}/${String(path).replace(/^\/+/, '')}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.href;
}

export function graphError(error = {}, status = null) {
  const code = Number(error.code);
  const subcode = Number(error.error_subcode);
  const message = String(error.message || `Erreur Facebook ${status || ''}`).trim();
  if (code === 190 || [463, 467].includes(subcode)) {
    return new ConnectorError('JETON_EXPIRE', `Jeton Facebook expiré ou révoqué : ${message}`, status);
  }
  if ([4, 17, 32, 613].includes(code)) {
    return new ConnectorError('LIMITE_DEBIT', `Limite de débit Facebook atteinte : ${message}`, status);
  }
  if (code === 10 || (code >= 200 && code <= 299)) {
    return new ConnectorError('PERMISSION_MANQUANTE', `Permission Facebook manquante : ${message}`, status);
  }
  if (code === 100) {
    return new ConnectorError('PAGE_INTROUVABLE', `Page ou publication Facebook introuvable : ${message}`, status);
  }
  return new ConnectorError(`FACEBOOK_${Number.isFinite(code) ? code : 'ERREUR'}`, message, status);
}

async function graphGet(config, path, params, deps) {
  const response = await guardedGet(graphUrl(config, path, params, deps), {
    headers: {
      Authorization: `Bearer ${config.page_token}`,
      Accept: 'application/json',
      'User-Agent': 'ANM-Veille/7.0 (+plateforme interne Wilaya d\'Alger)',
    },
    allowErrorStatus: true,
    ...deps,
  });
  let payload = null;
  try { payload = JSON.parse(response.body); } catch { payload = null; }
  if (response.status >= 400) throw graphError(payload?.error || {}, response.status);
  if (!payload || typeof payload !== 'object') {
    throw new ConnectorError('REPONSE_INVALIDE', 'Réponse Facebook illisible');
  }
  return payload;
}

function nextCursor(page, previous) {
  if (!page || !page.paging || !page.paging.next) return null;
  return page.paging.cursors?.after || previous || null;
}

function metrics(raw) {
  const output = {};
  const reactions = raw.reactions?.summary?.total_count;
  const comments = raw.comments?.summary?.total_count;
  const shares = raw.shares?.count;
  if (Number.isFinite(Number(reactions))) output.reactions = Number(reactions);
  if (Number.isFinite(Number(comments))) output.commentaires = Number(comments);
  if (Number.isFinite(Number(shares))) output.partages = Number(shares);
  return Object.keys(output).length ? output : null;
}

function gpsOf(raw) {
  const latitude = Number(raw.place?.location?.latitude);
  const longitude = Number(raw.place?.location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { lat: latitude, lng: longitude };
}

export function mapFacebook(raw, config = {}) {
  const pageName = raw._page_nom || config.page_nom || 'Facebook';
  if (raw._type === 'comment') {
    return {
      id_externe: raw.id,
      url: raw.permalink_url || raw._post_url || null,
      page_nom: pageName,
      auteur: raw.from?.name || null,
      texte: String(raw.message || '').trim(),
      date_publication: raw.created_time || null,
      type_media: 'comment',
      metriques: null,
    };
  }
  return {
    id_externe: raw.id,
    url: raw.permalink_url || null,
    page_nom: pageName,
    auteur: raw.from?.name || null,
    texte: String(raw.message || raw.story || '').trim(),
    date_publication: raw.created_time || null,
    type_media: raw._type === 'tagged' ? 'tag' : 'post',
    metriques: metrics(raw),
    gps: gpsOf(raw),
  };
}

async function collecter({ config, curseur = {}, depuis, deps = {} }) {
  const elements = [];
  const params = { fields: POST_FIELDS, limit: config.max_posts };
  if (curseur.after) params.after = curseur.after;
  else if (depuis && Number.isFinite(Date.parse(depuis))) {
    params.since = Math.floor(Date.parse(depuis) / 1000);
  }
  const feed = await graphGet(config, `${config.page_id}/feed`, params, deps);
  for (const post of feed.data || []) {
    elements.push({ ...post, _type: 'post', _page_nom: config.page_nom || null });
    if (!config.include_comments || config.max_comments === 0 || !post.id) continue;
    const comments = await graphGet(config, `${post.id}/comments`,
      { fields: COMMENT_FIELDS, limit: config.max_comments }, deps);
    for (const comment of comments.data || []) {
      elements.push({
        ...comment, _type: 'comment', _page_nom: config.page_nom || null,
        _post_url: post.permalink_url || null,
      });
    }
  }
  let tagged = null;
  if (config.include_tagged) {
    const taggedParams = { fields: TAG_FIELDS, limit: config.max_posts };
    if (curseur.tagged_after) taggedParams.after = curseur.tagged_after;
    tagged = await graphGet(config, `${config.page_id}/tagged`, taggedParams, deps);
    for (const post of tagged.data || []) {
      elements.push({ ...post, _type: 'tagged', _page_nom: config.page_nom || null });
    }
  }
  return {
    elements,
    curseurSuivant: {
      after: nextCursor(feed, curseur.after),
      tagged_after: nextCursor(tagged, curseur.tagged_after),
    },
    quota: {
      posts: (feed.data || []).length,
      tagged: tagged ? (tagged.data || []).length : 0,
      comments: elements.filter((element) => element._type === 'comment').length,
    },
  };
}

async function tester({ config, deps = {} }) {
  const page = await graphGet(config, config.page_id, { fields: 'id,name' }, deps);
  return { ok: true, page: { id: page.id || config.page_id, nom: page.name || null } };
}

function build(type, label, permissionNote) {
  return {
    id: type,
    type,
    label,
    permissionNote,
    schemaConfig: z.object(configShape).strict(),
    tester,
    collecter,
    mapper: (raw, config) => mapFacebook(raw, config),
  };
}

export const facebookManagedConnector = build(
  'facebook_page_geree',
  'Page Facebook gérée (API Graph)',
  'Exige un jeton de page avec pages_read_engagement ; collecte publications, commentaires et mentions.',
);

export const facebookPublicConnector = build(
  'facebook_page_publique',
  'Page Facebook publique (API Graph)',
  'Exige « Page Public Content Access » accordée par Meta ; sans elle, la collecte est refusée explicitement.',
);
