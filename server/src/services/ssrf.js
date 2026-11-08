import dns from 'node:dns/promises';
import net from 'node:net';
import { badRequest, business } from '../utils/errors.js';

export const RESOLVE_ALLOWED_HOSTS = new Set([
  'maps.app.goo.gl', 'goo.gl', 'www.google.com', 'maps.google.com',
  'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'youtube.com', 'youtu.be',
]);

function privateIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && [0, 168].includes(b))
    || (a === 192 && b === 0) || (a === 192 && parts[1] === 0 && parts[2] === 2)
    || (a === 198 && [18, 19, 51].includes(b))
    || (a === 203 && b === 0 && parts[2] === 113);
}

function privateIpv6(address) {
  const value = address.toLowerCase().split('%')[0];
  if (value === '::' || value === '::1') return true;
  const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateIpv4(mapped[1]);
  return value.startsWith('fc') || value.startsWith('fd') || /^fe[89ab]/.test(value)
    || value.startsWith('ff') || value.startsWith('2001:db8:');
}

export function isPrivateAddress(address) {
  const version = net.isIP(String(address || ''));
  if (version === 4) return privateIpv4(address);
  if (version === 6) return privateIpv6(address);
  return true;
}

export function validateResolveUrl(value, allowedHosts = RESOLVE_ALLOWED_HOSTS) {
  let url;
  try { url = new URL(String(value)); } catch { throw badRequest('URL invalide'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw badRequest('Seuls les liens http(s) sont autorisés');
  if (url.username || url.password) throw badRequest('Les identifiants intégrés à une URL sont interdits');
  if (url.port && !['80', '443'].includes(url.port)) throw badRequest('Port réseau non autorisé');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!allowedHosts.has(host)) throw business('Domaine non autorisé pour la résolution', 'DOMAINE_INTERDIT');
  if (net.isIP(host)) throw business('Adresse IP directe interdite', 'ADRESSE_INTERDITE');
  return url;
}

export async function assertPublicResolveUrl(value, lookup = dns.lookup) {
  const url = validateResolveUrl(value);
  let records;
  try { records = await lookup(url.hostname, { all: true, verbatim: true }); }
  catch { throw business('Résolution DNS impossible', 'DNS_INDISPONIBLE'); }
  const list = Array.isArray(records) ? records : [records];
  if (!list.length || list.some((record) => isPrivateAddress(record.address))) {
    throw business('Destination réseau privée ou réservée interdite', 'SSRF_INTERDIT');
  }
  return { url, addresses: list.map((record) => record.address) };
}

export async function validateRedirectChain(urls, lookup = dns.lookup, maxRedirects = 5) {
  if (!Array.isArray(urls) || urls.length > maxRedirects + 1) {
    throw business('Trop de redirections', 'TROP_DE_REDIRECTIONS');
  }
  const checked = [];
  for (const url of urls) checked.push(await assertPublicResolveUrl(url, lookup));
  return checked;
}
