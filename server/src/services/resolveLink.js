import { classifyUrl, isAllowedResolveHost, isShortSocialUrl, unwrapUrl, parseSmartPaste } from '@anm/shared';
import { assertPublicResolveUrl, validateResolveUrl } from './ssrf.js';
import { getResolveDeps, outboundDispatcher, withAbort, networkCode } from './outbound.js';
import { coordinatesFromHtml, placeFromHtml, readBoundedHtml } from './resolveHtml.js';

const headers = { 'User-Agent': 'Mozilla/5.0 ANM/6.0', Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'fr,ar;q=0.8,en;q=0.5' };
export const resolveHeaders = headers;
export async function resolveLink(url, { mode = 'cartes', bbox } = {}) {
  if (mode === 'aucune') return { ok: false, code: 'DISABLED' };
  const deps = getResolveDeps(); const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  let dispatcher; let current = url; let hops = 0;
  try {
    const start = validateResolveUrl(url);
    const social = classifyUrl(url).type === 'social';
    if (social && mode !== 'tous') return { ok: false, code: 'DISABLED' };
    const allowedHosts = { has: (host) => isAllowedResolveHost(host, social && mode === 'tous') };
    dispatcher = outboundDispatcher(deps);
    while (hops <= 6) {
      await withAbort(assertPublicResolveUrl(current, deps.lookupImpl, allowedHosts), controller.signal);
      const unwrapped = unwrapUrl(current);
      if (unwrapped !== current) { current = unwrapped; hops += 1; continue; }
      const item = classifyUrl(current, { bbox });
      if (!social && item.coords) return { ok: true, coords: { ...item.coords, source: 'lien_court' }, urlFinale: current, lieu: item.lieu, item };
      if (social && !isShortSocialUrl(new URL(current))) return { ok: true, urlFinale: current, item, dates: parseSmartPaste(current).dates };
      const response = await withAbort(deps.fetchImpl(current, { method: 'GET', redirect: 'manual', signal: controller.signal, dispatcher, headers }), controller.signal);
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel?.().catch(() => {});
        current = new URL(location, current).href; hops += 1; continue;
      }
      if (response.status >= 400) { await response.body?.cancel?.().catch(() => {}); return { ok: false, code: 'UPSTREAM_ERROR' }; }
      const html = social ? '' : await withAbort(readBoundedHtml(response), controller.signal);
      const coords = social ? null : coordinatesFromHtml(html, { bbox });
      const lieu = item.lieu || placeFromHtml(html);
      if (coords) return { ok: true, coords, urlFinale: current, lieu };
      return { ok: false, code: 'NO_COORDINATES', urlFinale: current, lieu, item: start.hostname === new URL(current).hostname ? item : undefined };
    }
    return { ok: false, code: 'TOO_MANY_REDIRECTS' };
  } catch (error) { return { ok: false, code: controller.signal.aborted ? 'TIMEOUT' : networkCode(error) }; }
  finally { clearTimeout(timer); await dispatcher?.destroy().catch(() => {}); }
}

export function cachedResolution(db, key) {
  const row = db.prepare('SELECT * FROM liens_cache WHERE url_normalise=?').get(key);
  if (!row) return null;
  try {
    const result = JSON.parse(row.meta_json);
    const ttl = row.succes ? 7 * 86400000 : 300000;
    if (typeof result.ok !== 'boolean' || !Number.isFinite(Date.parse(row.fetched_at)) || Date.now() - Date.parse(row.fetched_at) >= ttl) return null;
    return { ...result, urlFinale: row.url_finale || undefined, cache: true };
  } catch { return null; }
}
export function cacheResolution(db, key, result) {
  // Ni HTML, ni auteur, ni titre : uniquement URL, coordonnées et code de résultat.
  const { ok, coords, code } = result;
  db.prepare(`INSERT INTO liens_cache(url_normalise,url_finale,meta_json,fetched_at,succes) VALUES (?,?,?,?,?)
    ON CONFLICT(url_normalise) DO UPDATE SET url_finale=excluded.url_finale,meta_json=excluded.meta_json,fetched_at=excluded.fetched_at,succes=excluded.succes`)
    .run(key, result.urlFinale || null, JSON.stringify({ ok, coords, code }), new Date().toISOString(), ok ? 1 : 0);
}
