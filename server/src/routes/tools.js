import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { classifyUrl, parseSmartPaste, smartPasteSchema, zodFields } from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, badRequest } from '../utils/errors.js';
import { getParams } from '../services/settings.js';
import { cacheResolution, cachedResolution, resolveLink } from '../services/resolveLink.js';
import { audit } from '../services/audit.js';
export { setResolveDeps } from '../services/outbound.js';

const router = Router();
const limiter = rateLimit({ windowMs: 60000, max: 120, keyGenerator: (req) => String(req.user.id), standardHeaders: true, legacyHeaders: false });
const resolveLimiter = rateLimit({ windowMs: 60000, max: 30, keyGenerator: (req) => String(req.user.id), standardHeaders: true, legacyHeaders: false });
const resolveSchema = z.object({ url: z.string().trim().url().max(2000) });
const failures = new Map();
function auditFailure(req, url, code) {
  const host = new URL(url).hostname; const key = `${req.user.id}:${host}:${code}`;
  for (const [k, v] of failures) if (Date.now() - v.at > 60000) failures.delete(k);
  if (failures.size > 500) failures.delete(failures.keys().next().value);
  const entry = failures.get(key) || { at: Date.now(), count: 0 }; entry.count += 1; failures.set(key, entry);
  if (entry.count === 3) audit(req, 'RESOLVE_FAIL', { entite: 'connectivite', details: { host, code, count: entry.count, window: '60s' } });
}
router.post('/parse-paste', requireAuth, limiter, (req, res) => {
  const parsed = smartPasteSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Texte invalide', zodFields(parsed.error));
  res.json({ item: parseSmartPaste(parsed.data.texte, { bbox: getParams(getDb()).gps_bbox }) });
});
router.post('/resolve-link', requireAuth, resolveLimiter, asyncHandler(async (req, res) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('URL invalide', zodFields(parsed.error));
  const db = getDb(); const params = getParams(db); const key = parsed.data.url;
  const mode = params.resolution_liens || 'cartes';
  const disabled = mode === 'aucune' || mode !== 'tous' && classifyUrl(key).type === 'social';
  const result = disabled ? { ok: false, code: 'DISABLED' } : cachedResolution(db, key) || await resolveLink(key, { mode, bbox: params.gps_bbox });
  if (!disabled && !result.cache) cacheResolution(db, key, result);
  if (!result.ok && !disabled) auditFailure(req, key, result.code);
  // Alias maintenus pour les clients V5 déjà ouverts lors d'une mise à jour.
  res.json({ ...result, disponible: result.ok, url_finale: result.urlFinale,
    raison: result.code === 'DISABLED' ? 'RESOLUTION_DESACTIVEE' : result.code });
}));
export default router;
