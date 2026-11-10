import { describe, expect, it } from 'vitest';
import { encode, shorten } from 'pluscodes';
import { parseGps } from '../src/gps.js';
import { classifyUrl, coordinateFromMapUrl, parseSmartPaste } from '../src/smartPaste.js';

const options = { bbox: '36.40,2.50,36.95,3.40' };
describe('V6 — formats et priorité des positions', () => {
  it.each([
    ['https://waze.com/ul/hezs42', 42.60498, -5.60303],
    ['V75V+8R Alger', 36.858313, 3.294563],
    ['V75V+8R', 36.858313, 3.294563],
    ['849VCWC8+R9', 37.422063, -122.084063],
    ['https://www.bing.com/maps?cp=36.7538~3.0588', 36.7538, 3.0588],
    ['https://yandex.ru/maps/?ll=3.0588%2C36.7538', 36.7538, 3.0588],
    ['https://wego.here.com/?map=36.7538,3.0588,16', 36.7538, 3.0588],
    ['https://www.google.fr/maps/dir/36.7,3.0/36.7538,3.0588', 36.7538, 3.0588],
    ['https://www.google.dz/maps/place/March%C3%A9+Alger/data=!3d36.7538!4d3.0588', 36.7538, 3.0588],
    ['N 36.7538, E 3.0588', 36.7538, 3.0588],
    ['36.75 S 3.05 W', -36.75, -3.05],
    ['٣٦٫٧٥٣٨، ٣٫٠٥٨٨', 36.7538, 3.0588],
  ])('décode %s', (text, lat, lng) => {
    const point = parseSmartPaste(text, options).coords[0];
    expect(point?.lat).toBeCloseTo(lat, 5); expect(point?.lng).toBeCloseTo(lng, 5);
  });
  it('conserve le nom du lieu uniquement comme suggestion', () => {
    expect(classifyUrl('https://www.google.dz/maps/place/March%C3%A9+Alger/@36.75,3.05,15z').lieu).toBe('Marché Alger');
  });
  it('arrondit les centres OLC exactement à six décimales, des deux côtés de Greenwich', () => {
    expect(parseSmartPaste('849VCWC8+R9').coords[0]).toMatchObject({ lat: 37.422063, lng: -122.084063 });
    expect(parseSmartPaste('V75V+8R').coords[0]).toMatchObject({ lat: 36.858313, lng: 3.294563 });
  });
  it('épingle prioritaire, destination signalée, positions proches fusionnées', () => {
    expect(coordinateFromMapUrl('https://google.fr/maps/@36.7,3,8z/data=!3d36.7538!4d3.0588').lat).toBe(36.7538);
    expect(coordinateFromMapUrl('https://google.com/maps/dir/36.7,3/36.7538,3.0588').avertissement).toBe('DESTINATION');
    expect(parseSmartPaste('https://google.com/maps/@36.7538,3.0588,16z 36.75381,3.05881').coords).toHaveLength(1);
    expect(parseSmartPaste('https://google.com/maps/@36.75,3.05,16z 36.78,3.09').coords).toHaveLength(2);
  });
  it.each(['facebook.com', 'instagram.com', 'tiktok.com'])('ne lit JAMAIS de GPS sur %s', (host) => {
    const url = `https://${host}/p/@36.7538,3.0588?q=36.7538,3.0588`;
    expect(parseSmartPaste(url).coords).toEqual([]);
    expect(coordinateFromMapUrl(url)).toBeNull();
    expect(parseGps(url).ok).toBe(false);
  });
  it.each(['https://google.com.evil.example/maps/@36.75,3.05,17z', 'V75V+8R+6A', 'https://bing.com/maps?cp=3675380~305800', '36°65\'12"N 3°03\'30"E'])('rejette sans inventer : %s', (text) => expect(parseSmartPaste(text).coords).toEqual([]));
  it('les séquences URI et entités HTML malformées ne lèvent aucune exception', () => {
    for (const text of ['https://google.com/maps/%ZZ', '&#xFFFFFFFF; https://google.com/maps/@36.75,3.05,17z']) {
      expect(() => parseSmartPaste(text)).not.toThrow();
    }
  });
  it('aller-retour OLC des coordonnées de référence (dont code raccourci)', () => {
    for (const point of [[36.7538, 3.0588], [37.4220625, -122.0840625], [-33.86, 151.21]]) {
      const full = encode({ latitude: point[0], longitude: point[1] }, 11);
      const parsed = parseSmartPaste(full).coords[0];
      expect(parsed?.lat).toBeCloseTo(point[0], 4); expect(parsed?.lng).toBeCloseTo(point[1], 4);
    }
    const reference = { latitude: 36.7538, longitude: 3.0588 };
    const short = shorten(encode(reference), reference);
    expect(parseSmartPaste(short).coords[0]?.lat).toBeCloseTo(36.7538, 4);
  });
});
