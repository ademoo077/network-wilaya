import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import dns from 'node:dns/promises';
import { z } from 'zod';
import { classifyUrl, coordinateFromMapUrl, parseSmartPaste, smartPasteSchema, zodFields } from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, business } from '../utils/errors.js';
import { getParams } from '../services/settings.js';
import { assertPublicResolveUrl } from '../services/ssrf.js';

const router = Router();
const limiter = rateLimit({ windowMs: 60 * 1000, max: 120, keyGenerator: (req) => String(req.user.id), standardHeaders: true, legacyHeaders: false });
const resolveLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, keyGenerator: (req) => String(req.user.id), standardHeaders: true, legacyHeaders: false });
const resolveSchema = z.object({ url: z.string().trim().url().max(2000) });

const REDIRECT_MAX = 6;
const RESOLUTION_CACHE_TTL_SUCCESS = 7 * 24 * 60 * 60 * 1000;
const RESOLUTION_CACHE_TTL_FAILURE = 5 * 60 * 1000;

let resolveDeps = { fetchImpl: globalThis.fetch, lookupImpl: dns.lookup };

export function setResolveDeps(overrides = {}) {
  resolveDeps = { ...resolveDeps, ...overrides };
}

async function fetchFinalUrl(startUrl, maxRedirects = REDIRECT_MAX) {
  let current = startUrl;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    await assertPublicResolveUrl(current, resolveDeps.lookupImpl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await resolveDeps.fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'ANM-WilayaAlger/5.0 (+local)', accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
      });
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        current = new URL(location, current).href;
        continue;
      }
      return current;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw business('Trop de redirections', 'TROP_DE_REDIRECTIONS');
}

function readCache(db, urlKey) {
  const row = db.prepare('SELECT url_finale, meta_json, fetched_at FROM liens_cache WHERE url_normalise = ?').get(urlKey);
  if (!row) return null;
  const meta = (() => { try { return JSON.parse(row.meta_json || '{}'); } catch { return { ok: false, raison: 'CACHE_INVALIDE' }; } })();
  const ttl = meta.ok === false ? RESOLUTION_CACHE_TTL_FAILURE : RESOLUTION_CACHE_TTL_SUCCESS;
  const expiresAt = new Date(row.fetched_at).getTime() + ttl;
  if (Date.now() > expiresAt) return null;
  if (meta.ok === false) return { failure: meta, fetchedAt: new Date(row.fetched_at).getTime() };
  return { success: { urlFinale: row.url_finale, meta, fetchedAt: new Date(row.fetched_at).getTime() } };
}

function writeCache(db, urlKey, { ok, urlFinale = null, meta = null }) {
  db.prepare(`INSERT INTO liens_cache(url_normalise, url_finale, meta_json, fetched_at, succes) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(url_normalise) DO UPDATE SET url_finale=excluded.url_finale, meta_json=excluded.meta_json, fetched_at=excluded.fetched_at, succes=excluded.succes`)
    .run(urlKey, ok ? urlFinale : null, ok ? JSON.stringify(meta) : JSON.stringify({ ok: false, raison: meta?.raison || 'RESOLUTION_IMPOSSIBLE', message: meta?.message || null }), new Date().toISOString(), ok ? 1 : 0);
}

router.post('/parse-paste', requireAuth, limiter, (req, res) => {
  const parsed = smartPasteSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Texte invalide', zodFields(parsed.error));
  const bbox = getParams(getDb()).gps_bbox;
  res.json({ item: parseSmartPaste(parsed.data.texte, { bbox }) });
});

router.post('/resolve-link', requireAuth, resolveLimiter, async (req, res) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('URL invalide', zodFields(parsed.error));
  const params = getParams(getDb());
  const mode = String(params.resolution_liens || 'cartes');
  const db = getDb();
  const urlKey = parsed.data.url;

  if (mode === 'aucune') return res.json({ disponible: false, raison: 'RESOLUTION_DESACTIVEE' });
  if (mode !== 'cartes' && mode !== 'tous') {
    return res.json({ disponible: false, raison: 'MODE_INCONNU', message: 'Mode de resolution des liens courts inconnu' });
  }

  const cached = readCache(db, urlKey);
  if (cached?.success) {
    return res.json({ disponible: true, url_finale: cached.success.urlFinale, coords: cached.success.meta?.coords || null, item: cached.success.meta?.item || cached.success.meta, cache: true });
  }
  if (cached?.failure) {
    return res.json({ disponible: false, raison: cached.failure.raison, message: cached.failure.message, cached: true });
  }

  const classified = classifyUrl(urlKey, { bbox: params.gps_bbox });
  const shortMap = classified.a_resoudre === true;
  const social = classified.type === 'social';
  if (!shortMap && !(mode === 'tous' && social)) {
    return res.json({ disponible: false, raison: 'COORDONNEES_INTROUVABLES', message: 'Aucune resolution demandee pour ce type de lien.', item: classified });
  }

  try {
    const finalUrl = await fetchFinalUrl(urlKey);
    const resolved = classifyUrl(finalUrl, { bbox: params.gps_bbox });
    const coords = resolved.coords || coordinateFromMapUrl(finalUrl, { bbox: params.gps_bbox }) || null;
    writeCache(db, urlKey, { ok: true, urlFinale: finalUrl, meta: { ok: true, coords, item: resolved } });
    const body = { disponible: true, url_finale: finalUrl, coords, item: resolved };
    if (!coords) body.raison = 'COORDONNEES_INTROUVABLES';
    body.message = coords ? undefined : 'Lien resolu, mais aucune coordonnee trouvee dans l URL finale.';
    return res.json(body);
  } catch (error) {
    const raison = error.code || 'RESOLUTION_IMPOSSIBLE';
    writeCache(db, urlKey, { ok: false, meta: { raison, message: error.message } });
    return res.status(200).json({ disponible: false, raison, message: error.message });
  }
});

export default router;
