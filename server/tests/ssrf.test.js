import { describe, expect, it } from 'vitest';
import {
  assertPublicResolveUrl, isPrivateAddress, validateRedirectChain, validateResolveUrl,
} from '../src/services/ssrf.js';

const publicLookup = async () => [{ address: '142.250.74.196', family: 4 }];

describe('Garde SSRF de la résolution P2', () => {
  it('accepte un domaine explicitement autorisé', () => expect(validateResolveUrl('https://maps.google.com/?q=36,3').hostname).toBe('maps.google.com'));
  it('refuse un domaine hors liste', () => expect(() => validateResolveUrl('https://example.org/')).toThrow(/Domaine/));
  it('refuse les schémas non HTTP', () => expect(() => validateResolveUrl('file:///etc/passwd')).toThrow(/http/));
  it('refuse les identifiants dans URL', () => expect(() => validateResolveUrl('https://user:pass@www.google.com/')).toThrow(/identifiants/));
  it('refuse un port arbitraire', () => expect(() => validateResolveUrl('https://www.google.com:8080/')).toThrow(/Port/));
  it.each(['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.1.1', '100.64.0.1', '192.0.2.1'])('classe IPv4 %s comme privée/réservée', (address) => expect(isPrivateAddress(address)).toBe(true));
  it.each(['::1', 'fe80::1', 'fc00::1', 'fd00::1', '2001:db8::1', '::ffff:127.0.0.1'])('classe IPv6 %s comme privée/réservée', (address) => expect(isPrivateAddress(address)).toBe(true));
  it('accepte des adresses publiques v4 et v6', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('2607:f8b0:4005:805::200e')).toBe(false);
  });
  it('valide toutes les réponses DNS publiques', async () => {
    await expect(assertPublicResolveUrl('https://www.google.com/', publicLookup)).resolves.toMatchObject({ addresses: ['142.250.74.196'] });
  });
  it('refuse si une réponse DNS pointe vers le réseau interne', async () => {
    const rebinding = async () => [{ address: '142.250.1.1', family: 4 }, { address: '127.0.0.1', family: 4 }];
    await expect(assertPublicResolveUrl('https://www.google.com/', rebinding)).rejects.toMatchObject({ code: 'SSRF_INTERDIT' });
  });
  it('revalide une redirection vers une adresse interne', async () => {
    let calls = 0;
    const lookup = async () => [{ address: calls++ === 0 ? '142.250.1.1' : '10.0.0.2', family: 4 }];
    await expect(validateRedirectChain(['https://www.google.com/a', 'https://maps.google.com/b'], lookup)).rejects.toMatchObject({ code: 'SSRF_INTERDIT' });
  });
  it('borne le nombre de redirections', async () => {
    const urls = Array.from({ length: 7 }, (_, index) => `https://www.google.com/${index}`);
    await expect(validateRedirectChain(urls, publicLookup)).rejects.toMatchObject({ code: 'TROP_DE_REDIRECTIONS' });
  });
});
