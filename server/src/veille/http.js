import { assertPublicResolveUrl } from '../services/ssrf.js';
import { getResolveDeps, outboundDispatcher, withAbort, networkCode } from '../services/outbound.js';

const ANY_HOST = { has: () => true };

export class ConnectorError extends Error {
  constructor(code, message, status = null) {
    super(message);
    this.name = 'ConnectorError';
    this.code = code;
    this.status = status;
  }
}

async function readBounded(response, maxBytes, signal) {
  if (!response.body?.getReader) return '';
  const reader = response.body.getReader();
  const parts = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await withAbort(reader.read(), signal);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new ConnectorError('TROP_VOLUMINEUX', `Réponse supérieure à ${maxBytes} octets`);
      parts.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(parts).toString('utf8');
}

/** GET sortant borné, avec validation SSRF à chaque redirection. */
export async function guardedGet(url, {
  headers = {}, timeoutMs = 8000, maxBytes = 2 * 1024 * 1024, maxRedirects = 3,
  fetchImpl, lookupImpl, allowErrorStatus = false,
} = {}) {
  const base = getResolveDeps();
  const deps = {
    ...base,
    fetchImpl: fetchImpl || base.fetchImpl,
    lookupImpl: lookupImpl || base.lookupImpl,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let dispatcher;
  let current = String(url);
  let hops = 0;
  try {
    dispatcher = fetchImpl ? null : outboundDispatcher(deps);
    while (true) {
      await withAbort(assertPublicResolveUrl(current, deps.lookupImpl, ANY_HOST), controller.signal);
      let response;
      try {
        response = await withAbort(deps.fetchImpl(current, {
          method: 'GET', redirect: 'manual', signal: controller.signal, dispatcher, headers,
        }), controller.signal);
      } catch (error) {
        if (error instanceof ConnectorError) throw error;
        throw new ConnectorError(controller.signal.aborted ? 'DELAI_DEPASSE' : networkCode(error),
          controller.signal.aborted ? 'Délai de collecte dépassé' : 'Source inaccessible');
      }
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel?.().catch(() => {});
        hops += 1;
        if (hops > maxRedirects) throw new ConnectorError('TROP_DE_REDIRECTIONS', 'Trop de redirections');
        current = new URL(location, current).href;
        continue;
      }
      if (response.status === 304) {
        await response.body?.cancel?.().catch(() => {});
        return { status: 304, headers: response.headers, body: '', url: current };
      }
      if (response.status >= 400 && !allowErrorStatus) {
        await response.body?.cancel?.().catch(() => {});
        throw new ConnectorError(`HTTP_${response.status}`, `La source a répondu ${response.status}`, response.status);
      }
      const declared = Number(response.headers.get('content-length') || 0);
      if (declared > maxBytes) {
        await response.body?.cancel?.().catch(() => {});
        throw new ConnectorError('TROP_VOLUMINEUX', `Réponse supérieure à ${maxBytes} octets`);
      }
      const body = await readBounded(response, maxBytes, controller.signal);
      return { status: response.status, headers: response.headers, body, url: current };
    }
  } finally {
    clearTimeout(timer);
    await dispatcher?.destroy?.().catch(() => {});
  }
}
