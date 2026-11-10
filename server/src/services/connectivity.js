import { getResolveDeps, outboundDispatcher, withAbort, networkCode } from './outbound.js';
import { assertPublicResolveUrl } from './ssrf.js';
import { resolveHeaders } from './resolveLink.js';

let cache;
export async function checkConnectivity() {
  const deps = getResolveDeps();
  if (cache?.deps === deps && Date.now() - cache.at < 60000) return { ...cache.value, cache: true };
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  let dispatcher; let dns = false;
  let result;
  try {
    await withAbort(assertPublicResolveUrl('https://www.google.com/generate_204', deps.lookupImpl), controller.signal);
    dns = true; dispatcher = outboundDispatcher(deps);
    const response = await withAbort(deps.fetchImpl('https://www.google.com/generate_204', {
      redirect: 'manual', signal: controller.signal, dispatcher, headers: resolveHeaders,
    }), controller.signal);
    await response.body?.cancel?.().catch(() => {});
    result = { ok: response.status === 204, code: response.status === 204 ? 'OK' : 'UPSTREAM_ERROR' };
  } catch (error) { result = { ok: false, code: controller.signal.aborted ? 'TIMEOUT' : networkCode(error) }; }
  finally { clearTimeout(timer); await dispatcher?.destroy().catch(() => {}); }
  const value = { ...result, dns, https: result.ok, proxy: Boolean(deps.proxy), at: new Date().toISOString() };
  cache = { deps, at: Date.now(), value }; return value;
}
