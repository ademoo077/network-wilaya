import dns from 'node:dns/promises';
import { Agent, Pool, ProxyAgent, fetch } from 'undici';
import { guardedLookup, publicRecords } from './ssrf.js';

const defaults = () => ({ fetchImpl: fetch, lookupImpl: dns.lookup, timeoutMs: 6000, proxy: process.env.OUTBOUND_PROXY || '' });
let dependencies = defaults();
export function setResolveDeps(overrides = {}) { dependencies = Object.keys(overrides).length ? { ...dependencies, ...overrides } : defaults(); }
export const getResolveDeps = () => dependencies;

export function outboundDispatcher({ lookupImpl, proxy }) {
  if (!proxy) return new Agent({ connect: { lookup: guardedLookup(lookupImpl), timeout: 6000 } });
  // CONNECT vise l'adresse publique validée, tout en conservant Host et le SNI d'origine.
  // Le proxy ne peut donc pas résoudre à nouveau le nom vers une adresse privée.
  return new ProxyAgent({ uri: proxy, requestTls: { lookup: guardedLookup(lookupImpl) },
    clientFactory: (origin, options) => {
      const pool = new Pool(origin, options);
      return {
        async connect(request) {
          const target = new URL(`http://${request.path}`);
          const [record] = await publicRecords(target.hostname, lookupImpl);
          const address = record.family === 6 ? `[${record.address}]` : record.address;
          return pool.connect({ ...request, path: `${address}:${target.port || 80}` });
        },
        close: () => pool.close(), destroy: () => pool.destroy(),
      };
    } });
}
export function withAbort(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || new DOMException('Délai dépassé', 'AbortError'));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
export function networkCode(error) {
  const code = error?.cause?.code || error?.code || error?.name;
  if (['DOMAINE_INTERDIT', 'ADRESSE_INTERDITE', 'SSRF_INTERDIT', 'VALIDATION'].includes(code)) return 'BLOCKED_HOST';
  if (/TLS|CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code || '')) return 'TLS_ERROR';
  if (['AbortError', 'TimeoutError', 'UND_ERR_ABORTED'].includes(code)) return 'TIMEOUT';
  if (code === 'TOO_MANY_REDIRECTS') return code;
  return 'NETWORK_UNAVAILABLE';
}
