import { describe, it, expect } from 'vitest';
import { normaliserUrl, detecterPlateforme, isSafeHttpUrl } from '../src/url.js';

describe('normaliserUrl', () => {
  it('normalise un lien Facebook (www, fragment, suivi, slash)', () => {
    const result = normaliserUrl('https://www.facebook.com/page/video/?fbclid=abc&utm_source=x&id=42#comments');
    expect(result.ok).toBe(true);
    expect(result.url).toBe('https://facebook.com/page/video?id=42');
    expect(result.plateforme).toBe('facebook');
  });

  it('trie les paramètres restants et retire m./mobile.', () => {
    const result = normaliserUrl('https://m.instagram.com/p/ABC/?b=2&a=1');
    expect(result.ok).toBe(true);
    expect(result.url).toBe('https://instagram.com/p/ABC?a=1&b=2');
  });

  it('rejette javascript:, data: et les URL invalides', () => {
    expect(normaliserUrl('javascript:alert(1)').ok).toBe(false);
    expect(normaliserUrl('data:text/html,x').ok).toBe(false);
    expect(normaliserUrl('pas une url').ok).toBe(false);
    expect(normaliserUrl('').ok).toBe(false);
  });

  it('détecte les plateformes par hôte et sous-domaine', () => {
    expect(detecterPlateforme('vm.tiktok.com')).toBe('tiktok');
    expect(detecterPlateforme('youtu.be')).toBe('youtube');
    expect(detecterPlateforme('twitter.com')).toBe('x');
    expect(detecterPlateforme('wa.me')).toBe('whatsapp');
    expect(detecterPlateforme('t.me')).toBe('telegram');
    expect(detecterPlateforme('example.dz')).toBe('autre');
  });

  it('conserve http(s) et refuse les hôtes douteux', () => {
    expect(normaliserUrl('http://example.dz/a/').url).toBe('http://example.dz/a');
    expect(normaliserUrl('https://-bad.dz/a').ok).toBe(false);
  });
});

describe('isSafeHttpUrl', () => {
  it('accepte http/https uniquement', () => {
    expect(isSafeHttpUrl('https://example.dz')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
  });
});
