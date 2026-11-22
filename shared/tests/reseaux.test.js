import { describe, expect, it } from 'vitest';
import { extraireIdentiteSource, natureSuggeree, nomSuggere, normaliserIdentifiant } from '../src/reseaux.js';

// url, réseau, contenu_type, statut, type identifiant, valeur, page_url
const VECTEURS = [
  ['https://www.facebook.com/aintaya.news', 'facebook', 'autre', 'identifie', 'slug', 'aintaya.news', 'https://facebook.com/aintaya.news'],
  ['https://facebook.com/Aintaya.News/', 'facebook', 'autre', 'identifie', 'slug', 'Aintaya.News', 'https://facebook.com/Aintaya.News'],
  ['https://m.facebook.com/aintaya.news/posts/123/', 'facebook', 'post', 'identifie', 'slug', 'aintaya.news', 'https://facebook.com/aintaya.news'],
  ['https://web.facebook.com/aintaya.news/videos/456/?fbclid=abc', 'facebook', 'video', 'identifie', 'slug', 'aintaya.news', 'https://facebook.com/aintaya.news'],
  ['https://mbasic.facebook.com/aintaya.news/photos/789', 'facebook', 'photo', 'identifie', 'slug', 'aintaya.news', 'https://facebook.com/aintaya.news'],
  ['https://facebook.com/aintaya.news/reels/12', 'facebook', 'reel', 'identifie', 'slug', 'aintaya.news', 'https://facebook.com/aintaya.news'],
  ['https://facebook.com/profile.php?id=123456', 'facebook', 'autre', 'identifie', 'id', '123456', 'https://facebook.com/profile.php?id=123456'],
  ['https://www.facebook.com/profile.php?id=123456&sk=about', 'facebook', 'autre', 'identifie', 'id', '123456', 'https://facebook.com/profile.php?id=123456'],
  ['https://facebook.com/permalink.php?story_fbid=999&id=123456', 'facebook', 'post', 'identifie', 'id', '123456', 'https://facebook.com/profile.php?id=123456'],
  ['https://m.facebook.com/story.php?story_fbid=999&id=123456', 'facebook', 'story', 'identifie', 'id', '123456', 'https://facebook.com/profile.php?id=123456'],
  ['https://facebook.com/pages/Aintaya-News/123456/', 'facebook', 'autre', 'identifie', 'id', '123456', 'https://facebook.com/profile.php?id=123456'],
  ['https://facebook.com/people/Amine-Benaissa/123456', 'facebook', 'autre', 'identifie', 'id', '123456', 'https://facebook.com/profile.php?id=123456'],
  ['https://facebook.com/groups/123456789/posts/1/', 'facebook', 'post', 'identifie', 'id', '123456789', 'https://facebook.com/groups/123456789'],
  ['https://facebook.com/groups/urbanisme-alger/posts/42', 'facebook', 'post', 'identifie', 'slug', 'urbanisme-alger', 'https://facebook.com/groups/urbanisme-alger'],
  ['https://facebook.com/groups/123456/user/98765', 'facebook', 'autre', 'identifie', 'id', '98765', 'https://facebook.com/profile.php?id=98765'],
  ['https://facebook.com/1234567890', 'facebook', 'autre', 'identifie', 'id', '1234567890', 'https://facebook.com/profile.php?id=1234567890'],
  ['https://www.facebook.com/share/p/19S9HP1xWn/', 'facebook', 'post', 'indetermine', null, null, null],
  ['https://facebook.com/share/v/abc', 'facebook', 'video', 'indetermine', null, null, null],
  ['https://facebook.com/share/r/abc', 'facebook', 'reel', 'indetermine', null, null, null],
  ['https://facebook.com/reel/123456', 'facebook', 'reel', 'indetermine', null, null, null],
  ['https://fb.watch/abc123/', 'facebook', 'video', 'indetermine', null, null, null],
  ['https://www.facebook.com/watch/?v=123', 'facebook', 'video', 'indetermine', null, null, null],
  ['https://facebook.com/photo.php?fbid=123', 'facebook', 'photo', 'indetermine', null, null, null],
  ['https://facebook.com/events/123', 'facebook', 'autre', 'indetermine', null, null, null],
  ['https://facebook.com/marketplace/items/1', 'facebook', 'autre', 'indetermine', null, null, null],
  ['https://facebook.com/hashtag/alger', 'facebook', 'autre', 'indetermine', null, null, null],
  ['https://facebook.com/sharer/sharer.php?u=x', 'facebook', 'autre', 'indetermine', null, null, null],
  ['https://facebook.com/plugins/page.php?href=x', 'facebook', 'autre', 'indetermine', null, null, null],
  ['https://facebook.com/login/', 'facebook', 'autre', 'indetermine', null, null, null],
  ['https://facebook.com/help/', 'facebook', 'autre', 'indetermine', null, null, null],
  ['https://facebook.com/policies/', 'facebook', 'autre', 'indetermine', null, null, null],
  ['https://facebook.com/share/p/19S9HP1xWn/?fbclid=x', 'facebook', 'post', 'indetermine', null, null, null],
  ['https://www.instagram.com/aintaya.news/', 'instagram', 'autre', 'identifie', 'handle', 'aintaya.news', 'https://instagram.com/aintaya.news'],
  ['https://m.instagram.com/aintaya.news/p/Cabc/?igshid=xyz', 'instagram', 'post', 'identifie', 'handle', 'aintaya.news', 'https://instagram.com/aintaya.news'],
  ['https://instagram.com/aintaya.news/reel/Cabc', 'instagram', 'reel', 'identifie', 'handle', 'aintaya.news', 'https://instagram.com/aintaya.news'],
  ['https://instagram.com/stories/aintaya.news/123', 'instagram', 'story', 'identifie', 'handle', 'aintaya.news', 'https://instagram.com/aintaya.news'],
  ['https://instagram.com/p/Cabc/', 'instagram', 'post', 'indetermine', null, null, null],
  ['https://instagram.com/reel/Cabc/', 'instagram', 'reel', 'indetermine', null, null, null],
  ['https://instagr.am/aintaya.news', 'instagram', 'autre', 'identifie', 'handle', 'aintaya.news', 'https://instagram.com/aintaya.news'],
  ['https://instagram.com/explore/tags/alger', 'instagram', 'autre', 'indetermine', null, null, null],
  ['https://instagram.com/accounts/login/', 'instagram', 'autre', 'indetermine', null, null, null],
  ['https://www.tiktok.com/@aintaya.news/video/123456', 'tiktok', 'video', 'identifie', 'handle', 'aintaya.news', 'https://tiktok.com/@aintaya.news'],
  ['https://m.tiktok.com/@Aintaya.News', 'tiktok', 'autre', 'identifie', 'handle', 'Aintaya.News', 'https://tiktok.com/@Aintaya.News'],
  ['https://www.tiktok.com/@user/photo/123', 'tiktok', 'photo', 'identifie', 'handle', 'user', 'https://tiktok.com/@user'],
  ['https://vm.tiktok.com/ZMabc/', 'tiktok', 'autre', 'indetermine', null, null, null],
  ['https://vt.tiktok.com/ZMabc/', 'tiktok', 'autre', 'indetermine', null, null, null],
  ['https://www.youtube.com/@AintayaNews', 'youtube', 'autre', 'identifie', 'canal', '@AintayaNews', 'https://youtube.com/@AintayaNews'],
  ['https://m.youtube.com/channel/UCabc123', 'youtube', 'autre', 'identifie', 'canal', 'UCabc123', 'https://youtube.com/channel/UCabc123'],
  ['https://youtube.com/c/AintayaNews', 'youtube', 'autre', 'identifie', 'canal', 'AintayaNews', 'https://youtube.com/c/AintayaNews'],
  ['https://youtube.com/user/aintayanews', 'youtube', 'autre', 'identifie', 'canal', 'aintayanews', 'https://youtube.com/user/aintayanews'],
  ['https://www.youtube.com/watch?v=abc123', 'youtube', 'video', 'indetermine', null, null, null],
  ['https://youtu.be/abc123', 'youtube', 'video', 'indetermine', null, null, null],
  ['https://youtube.com/shorts/abc', 'youtube', 'short', 'indetermine', null, null, null],
  ['https://youtube.com/live/abc', 'youtube', 'direct', 'indetermine', null, null, null],
  ['https://x.com/AintayaNews/status/123456', 'x', 'post', 'identifie', 'handle', 'AintayaNews', 'https://x.com/AintayaNews'],
  ['https://twitter.com/AintayaNews/status/123456?s=20', 'x', 'post', 'identifie', 'handle', 'AintayaNews', 'https://x.com/AintayaNews'],
  ['https://x.com/i/web/status/123', 'x', 'autre', 'indetermine', null, null, null],
  ['https://t.co/abc', 'x', 'autre', 'indetermine', null, null, null],
  ['https://t.me/aintaya_news/123', 'telegram', 'post', 'identifie', 'canal', 'aintaya_news', 'https://t.me/aintaya_news'],
  ['https://t.me/s/aintaya_news', 'telegram', 'autre', 'indetermine', null, null, null],
  ['https://telegram.me/aintayanews', 'telegram', 'autre', 'identifie', 'canal', 'aintayanews', 'https://t.me/aintayanews'],
  ['https://example.com/posts/1', 'autre', 'autre', 'indetermine', null, null, null],
  ['javascript:alert(1)', 'autre', 'autre', 'indetermine', null, null, null],
];

describe('V14 — extraireIdentiteSource (table de vecteurs)', () => {
  expect(VECTEURS.length).toBeGreaterThanOrEqual(50);
  for (const [url, reseau, contenu_type, statut, type, valeur, page_url] of VECTEURS) {
    it(url, () => {
      const resultat = extraireIdentiteSource(url);
      expect(resultat.reseau).toBe(reseau);
      expect(resultat.contenu_type).toBe(contenu_type);
      expect(resultat.statut).toBe(statut);
      expect(resultat.identifiants).toEqual(type ? [{ type, valeur }] : []);
      expect(resultat.page_url).toBe(page_url);
    });
  }
});

describe('V14 — helpers d’identité', () => {
  it('normalise la casse sans altérer points et tirets', () => {
    expect(normaliserIdentifiant('slug', ' Aintaya.News ')).toBe('aintaya.news');
    expect(normaliserIdentifiant('handle', '@Aintaya.News')).toBe('aintaya.news');
    expect(normaliserIdentifiant('canal', '@UCAbC-12')).toBe('ucabc-12');
  });
  it('suggère la nature et un nom lisible sans jamais deviner sur un partage', () => {
    const page = extraireIdentiteSource('https://facebook.com/aintaya.news');
    expect(natureSuggeree(page)).toBe('page');
    expect(nomSuggere(page)).toBe('Aintaya News');
    expect(natureSuggeree(extraireIdentiteSource('https://facebook.com/groups/urbanisme-alger'))).toBe('groupe');
    expect(natureSuggeree(extraireIdentiteSource('https://facebook.com/profile.php?id=42'))).toBe('profil');
    expect(natureSuggeree(extraireIdentiteSource('https://www.facebook.com/profile.php?id=61590719786996'))).toBe('page');
    expect(natureSuggeree(extraireIdentiteSource('https://facebook.com/people/Amine-Benaissa/123456'))).toBe('profil');
    expect(natureSuggeree(extraireIdentiteSource('https://youtube.com/@AintayaNews'))).toBe('chaine');
    const partage = extraireIdentiteSource('https://www.facebook.com/share/p/19S9HP1xWn/');
    expect(natureSuggeree(partage)).toBe('autre');
    expect(nomSuggere(partage)).toBe('');
  });
  it('refuse les URL avec identifiants ou port inhabituels', () => {
    expect(extraireIdentiteSource('https://user:pass@facebook.com/aintaya.news').statut).toBe('indetermine');
    expect(extraireIdentiteSource('https://facebook.com:8443/aintaya.news').statut).toBe('indetermine');
  });
});
