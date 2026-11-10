import dns from 'node:dns/promises';
import net from 'node:net';
import ipaddr from 'ipaddr.js';
import { isAllowedResolveHost } from '@anm/shared';
import { badRequest, business } from '../utils/errors.js';

export const RESOLVE_ALLOWED_HOSTS = { has: (host) => isAllowedResolveHost(host) };
export function isPrivateAddress(address) {
  if (!net.isIP(String(address || ''))) return true;
  try { return ipaddr.process(address).range() !== 'unicast'; } catch { return true; }
}
export function validateResolveUrl(value, allowedHosts = RESOLVE_ALLOWED_HOSTS) {
  let url;
  try { url = new URL(String(value)); } catch { throw badRequest('URL invalide'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw badRequest('Seuls les liens http(s) sont autorisés');
  if (url.username || url.password) throw badRequest('Les identifiants intégrés dans une URL sont interdits');
  if (url.port && !['80', '443'].includes(url.port)) throw badRequest('Port réseau non autorisé');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!allowedHosts.has(host)) throw business('Domaine non autorisé pour la résolution', 'DOMAINE_INTERDIT');
  if (net.isIP(host)) throw business('Adresse IP directe interdite', 'ADRESSE_INTERDITE');
  return url;
}
export async function publicRecords(hostname, lookup = dns.lookup) {
  let records;
  try { records = await lookup(hostname, { all: true, verbatim: true }); }
  catch { throw business('Résolution DNS impossible', 'DNS_INDISPONIBLE'); }
  const list = Array.isArray(records) ? records : [records];
  if (!list.length || list.some((record) => isPrivateAddress(record?.address))) {
    throw business('Destination réseau privé ou réservé interdite', 'SSRF_INTERDIT');
  }
  return list.map((record) => ({ ...record, family: net.isIP(record.address) }));
}
export async function assertPublicResolveUrl(value, lookup = dns.lookup, allowedHosts = RESOLVE_ALLOWED_HOSTS) {
  const url = validateResolveUrl(value, allowedHosts);
  const records = await publicRecords(url.hostname, lookup);
  return { url, addresses: records.map((record) => record.address) };
}
export function guardedLookup(lookup = dns.lookup) {
  return (hostname, options, callback) => publicRecords(hostname, lookup).then((records) => {
    const matching = options.family ? records.filter((r) => r.family === options.family) : records;
    if (!matching.length) return callback(business('Résolution DNS impossible', 'DNS_INDISPONIBLE'));
    if (options.all) callback(null, matching);
    else callback(null, matching[0].address, matching[0].family);
  }, callback);
}
export async function validateRedirectChain(urls, lookup = dns.lookup, maxRedirects = 5) {
  if (!Array.isArray(urls) || urls.length > maxRedirects + 1) throw business('Trop de redirections', 'TROP_DE_REDIRECTIONS');
  const checked = [];
  for (const url of urls) checked.push(await assertPublicResolveUrl(url, lookup));
  return checked;
}
