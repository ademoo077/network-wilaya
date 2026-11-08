import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { classifyUrl, coordinateFromMapUrl, parseSmartPaste, smartPasteSchema, zodFields } from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest } from '../utils/errors.js';
import { getParams } from '../services/settings.js';
import { assertPublicResolveUrl } from '../services/ssrf.js';

const router = Router();
const limiter = rateLimit({ windowMs: 60 * 1000, max: 120, keyGenerator: (req) => String(req.user.id), standardHeaders: true, legacyHeaders: false });
const resolveLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, keyGenerator: (req) => String(req.user.id), standardHeaders: true, legacyHeaders: false });
const resolveSchema = z.object({ url: z.string().trim().url().max(2000) });

async function fetchFinalUrl(startUrl, maxRedirects = 5) {
  let current = startUrl;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    await assertPublicResolveUrl(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(current, {
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
  throw badRequest('Trop de redirections');
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
  if (String(params.enrichissement_en_ligne) !== '1') {
    return res.json({ disponible: false, raison: 'ENRICHISSEMENT_DESACTIVE' });
  }
  try {
    const finalUrl = await fetchFinalUrl(parsed.data.url);
    const classified = classifyUrl(finalUrl, { bbox: params.gps_bbox });
    const coords = classified.coords || coordinateFromMapUrl(finalUrl, { bbox: params.gps_bbox }) || null;
    return res.json({
      disponible: true,
      url_finale: finalUrl,
      coords,
      item: classified,
      ...(coords ? {} : { raison: 'COORDONNEES_INTROUVABLES', message: 'Lien résolu, mais aucune coordonnée trouvée dans l’URL finale.' }),
    });
  } catch (error) {
    return res.status(200).json({
      disponible: false,
      raison: error.code || 'RESOLUTION_IMPOSSIBLE',
      message: error.message,
    });
  }
});

export default router;
