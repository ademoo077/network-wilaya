import { describe, expect, it } from 'vitest';
import {
  INSTAGRAM_ALPHABET, INSTAGRAM_EPOCH,
} from '../src/smartPasteDates.js';
import {
  estimateInstagramDate, estimateTikTokDate, normalizeSmartText, parseSmartPaste,
} from '../src/smartPaste.js';

const options = { bbox: '36.40,2.50,36.95,3.40', today: '2026-12-31' };

function expectAlgiers(input, expected = { lat: 36.7538, lng: 3.0588 }) {
  const result = parseSmartPaste(input, options);
  expect(result.coords).toHaveLength(1);
  expect(result.coords[0].lat).toBeCloseTo(expected.lat, 5);
  expect(result.coords[0].lng).toBeCloseTo(expected.lng, 5);
}

function instagramCode(mediaId) {
  let value = mediaId;
  let output = '';
  while (value > 0n) {
    output = INSTAGRAM_ALPHABET[Number(value % 64n)] + output;
    value /= 64n;
  }
  return output || 'A';
}

describe('parseSmartPaste — coordonnées', () => {
  it.each([
    '36.7538, 3.0588',
    '36.7538 3.0588',
    '36.7538;3.0588',
    'lat: 36.7538 lng: 3.0588',
    '36,7538 3,0588',
    '٣٦٫٧٥٣٨، ٣٫٠٥٨٨',
    '۳۶٫۷۵۳۸ ۳٫۰۵۸۸',
  ])('comprend le format décimal « %s »', (input) => expectAlgiers(input));

  it.each([
    `36°45'13.68"N 3°03'31.68"E`,
    'N36 45.228 E3 03.528',
    `36°45′13.68″ش 3°03′31.68″شرق`,
  ])('comprend le format DMS « %s »', (input) => expectAlgiers(input));

  it.each([
    'https://www.google.com/maps/place/Test/@36.7000,3.0000,12z/data=!3d36.7538!4d3.0588',
    'https://maps.google.com/?q=36.7538,3.0588',
    'https://www.google.com/maps?query=36.7538%2C3.0588',
    'https://maps.google.com/?ll=36.7538,3.0588',
    'https://www.google.com/maps/@36.7538,3.0588,15z',
    'https://www.waze.com/ul?ll=36.7538%2C3.0588',
    'https://maps.apple.com/?ll=36.7538,3.0588',
    'https://www.openstreetmap.org/#map=15/36.7538/3.0588',
    'https://www.openstreetmap.org/?mlat=36.7538&mlon=3.0588',
    'geo:36.7538,3.0588',
  ])('extrait la position du lien « %s »', (input) => expectAlgiers(input));

  it('donne la priorité à l’épingle Google plutôt qu’au centre', () => expectAlgiers('https://google.com/maps/@35.1,2.1,9z/data=!3d36.7538!4d3.0588'));
  it('détecte deux positions sans en supprimer une', () => {
    const result = parseSmartPaste('Point A 36.7538,3.0588 et point B 36.8000,3.1000', options);
    expect(result.coords).toHaveLength(2);
  });
  it('rejette zéro zéro', () => expect(parseSmartPaste('0.0000, 0.0000', options).coords).toEqual([]));
  it('signale une position hors zone sans la bloquer', () => expect(parseSmartPaste('48.8566, 2.3522', options).coords[0].hors_zone).toBe(true));
  it('propose une inversion uniquement si la latitude dépasse 90', () => expect(parseSmartPaste('120.0000, 36.7000', options).coords[0]).toMatchObject({ lat: 36.7, lng: 120, inversionProposee: true }));
  it('ne confond pas une date ou un téléphone avec une position', () => expect(parseSmartPaste('12/10/2026 téléphone 0555 12 34 56', options).coords).toEqual([]));
});

describe('parseSmartPaste — URL et contenu', () => {
  it.each([
    ['https://facebook.com/reel/123', 'facebook', 'reel'],
    ['https://facebook.com/watch/?v=123', 'facebook', 'video'],
    ['https://facebook.com/user/photos/123', 'facebook', 'photo'],
    ['https://instagram.com/reel/ABC/', 'instagram', 'reel'],
    ['https://instagram.com/p/ABC/', 'instagram', 'post'],
    ['https://instagram.com/stories/user/1', 'instagram', 'story'],
    ['https://tiktok.com/@user/video/123', 'tiktok', 'video'],
    ['https://tiktok.com/@user/photo/123', 'tiktok', 'photo'],
    ['https://youtube.com/shorts/abc', 'youtube', 'short'],
    ['https://youtube.com/watch?v=abc', 'youtube', 'video'],
    ['https://x.com/user/status/123', 'x', 'post'],
  ])('classe %s', (url, platform, content) => {
    expect(parseSmartPaste(url, options).urls[0]).toMatchObject({ type: 'social', plateforme: platform, contenuType: content });
  });

  it.each([
    ['https://l.facebook.com/l.php?u=https%3A%2F%2Finstagram.com%2Freel%2FABC', 'instagram'],
    ['https://www.google.com/url?q=https%3A%2F%2Ffacebook.com%2Freel%2F123', 'facebook'],
    ['https://l.instagram.com/?u=https%3A%2F%2Ftiktok.com%2F%40u%2Fvideo%2F123', 'tiktok'],
    ['https://out.tiktok.com/?url=https%3A%2F%2Fyoutube.com%2Fshorts%2Fabc', 'youtube'],
  ])('déballe le lien enveloppé %s', (url, platform) => expect(parseSmartPaste(url, options).urls[0].plateforme).toBe(platform));

  it('accepte un domaine connu sans schéma et retire la ponctuation finale', () => {
    expect(parseSmartPaste('شاهد facebook.com/reel/123،', options).urls[0]).toMatchObject({ plateforme: 'facebook', contenuType: 'reel' });
  });
  it('marque un lien cartographique court à résoudre sans inventer de GPS', () => {
    const result = parseSmartPaste('https://maps.app.goo.gl/AbCd', options);
    expect(result.urls[0]).toMatchObject({ type: 'carte', a_resoudre: true });
    expect(result.coords).toEqual([]);
  });
  it('classe un lien inconnu sans l’interpréter', () => expect(parseSmartPaste('https://example.org/page', options).urls[0].type).toBe('autre'));
});

describe('parseSmartPaste — dates et texte', () => {
  it('normalise chiffres, direction et entités HTML', () => expect(normalizeSmartText('\u202A٣٦٫٧٥&amp;۰۳\u202C')).toBe('36.75&03'));
  it('estime une date TikTok par aller-retour synthétique', () => {
    const seconds = BigInt(Math.floor(Date.UTC(2026, 9, 12, 10) / 1000));
    const id = ((seconds << 32n) | 123n).toString();
    expect(estimateTikTokDate(id, options)).toBe('2026-10-12');
    expect(parseSmartPaste(`https://tiktok.com/@u/video/${id}`, options).dates[0]).toMatchObject({ date: '2026-10-12', estimee: true });
  });
  it('estime une date Instagram par aller-retour synthétique', () => {
    const timestamp = BigInt(Date.UTC(2026, 9, 12, 10));
    const code = instagramCode(((timestamp - INSTAGRAM_EPOCH) << 23n) | 321n);
    expect(estimateInstagramDate(code, options)).toBe('2026-10-12');
    expect(parseSmartPaste(`https://instagram.com/reel/${code}/`, options).dates[0]).toMatchObject({ date: '2026-10-12', estimee: true });
  });
  it('ignore une estimation hors garde-fou', () => expect(estimateTikTokDate(((1n << 32n) | 1n).toString(), options)).toBeNull());
  it('extrait une date explicite valide', () => expect(parseSmartPaste('Signalé le 12/10/2026', options).dates[0]).toMatchObject({ date: '2026-10-12', estimee: false }));
  it('conserve seulement le texte restant après URL et coordonnées', () => {
    const result = parseSmartPaste('Fuite importante https://facebook.com/reel/123 position 36.7538,3.0588', options);
    expect(result.texteRestant).toContain('Fuite importante');
    expect(result.texteRestant).not.toContain('facebook');
    expect(result.texteRestant).not.toContain('36.7538');
  });
  it('ne produit aucune date pour Facebook seul', () => expect(parseSmartPaste('https://facebook.com/reel/123', options).dates).toEqual([]));
});
