import { describe, expect, it } from 'vitest';
import { compteSocialCreateSchema, compteSocialUpdateSchema, normaliserCompteSocial, reseauxSociauxQuerySchema, socialTerritoryKey } from '../src/index.js';

describe('Identités publiques des comptes sociaux, sans résolution distante', () => {
  it.each([
    ['http://www.facebook.com/ALGER.Local/?fbclid=abc#top', 'https://facebook.com/alger.local', 'facebook'],
    ['https://m.facebook.com/profile.php?id=123&__cft__[0]=abc&__tn__=x', 'https://facebook.com/profile.php?id=123', 'facebook'],
    ['https://www.facebook.com/groups/456/?multi_permalinks=999', 'https://facebook.com/groups/456', 'facebook'],
    ['https://www.facebook.com/groups/456/user/123/', 'https://facebook.com/profile.php?id=123', 'facebook'],
    ['https://www.tiktok.com/@Ramzi.World/video/7511393355998170424?_t=abc&_r=1', 'https://tiktok.com/@ramzi.world', 'tiktok'],
    ['https://www.facebook.com/Akhbarouledfayet/reels/', 'https://facebook.com/akhbarouledfayet', 'facebook'],
    ['https://www.youtube.com/channel/UCAbCdEf/videos', 'https://youtube.com/channel/UCAbCdEf', 'youtube'],
    ['https://twitter.com/Quartier/status/123?s=20', 'https://x.com/quartier', 'x'],
  ])('identifie %s', (raw, expected, network) => {
    expect(normaliserCompteSocial(raw)).toMatchObject({ ok: true, url: expected, plateforme: network, compte_url: expected });
  });
  it('ne confond pas un membre avec le groupe', () => {
    expect(normaliserCompteSocial('https://facebook.com/groups/456/user/123')).toMatchObject({ nature: 'profil' });
    expect(normaliserCompteSocial('https://facebook.com/groups/456')).toMatchObject({ nature: 'groupe' });
  });
  it.each(['https://facebook.com/reel/123', 'https://instagram.com/p/ABCD', 'https://youtube.com/watch?v=123',
    'https://t.co/AbCd', 'https://fb.watch/AbCd', 'https://vm.tiktok.com/ZAbCd', 'https://youtu.be/@inconnu'])('ne devine pas l’auteur de %s', (raw) => {
    expect(normaliserCompteSocial(raw)).toMatchObject({ ok: true, compte_url: null, publication: true });
  });
  it.each(['javascript:alert(1)', 'file:///C:/local', 'https://user:password@facebook.com/local', 'https://facebook.com:3000/local', 'https://facebook.com', 'non-url'])('rejette %s', (raw) => {
    expect(normaliserCompteSocial(raw).ok).toBe(false);
  });
  it('ne détecte pas Facebook sur un domaine trompeur', () => {
    expect(normaliserCompteSocial('https://facebook.com.example.org/local')).toMatchObject({ ok: true, plateforme: 'autre' });
  });
  it.each([
    ['GUE DE CONSTANTINE', 'Djasr Kasentina'], ['STAOUALI', 'Staoueli'], ['BABA HACENE', 'Baba Hassen'],
    ['KHRAICIA', 'Khraissia'], ['BAB ZOUAR', 'Bab Ezzouar'], ['MOHAMADIA', 'Mohammadia'], ['BOLOGHIN', 'Bologhine'],
    ['DELY BRAHIM', 'Dely Ibrahim'],
  ])('reconnaît la variante transmise %s', (source, reference) => expect(socialTerritoryKey(source)).toBe(socialTerritoryKey(reference)));
});

describe('Contrats partagés du répertoire social', () => {
  const input = { nom: '[DEMO] Quartier', lien_url: 'https://facebook.com/quartier', plateforme: 'facebook', categorie: 'page' };
  it('valide les valeurs et applique les défauts', () => {
    expect(compteSocialCreateSchema.parse(input)).toMatchObject({ actif: 1, verification: 'a_verifier', observations: '' });
  });
  it('exige un nom manuel et rejette les métadonnées d’import falsifiées', () => {
    expect(compteSocialCreateSchema.safeParse({ ...input, nom: '  ' }).success).toBe(false);
    expect(compteSocialCreateSchema.safeParse({ ...input, origine: 'excel', nom_source: 'autre' }).success).toBe(false);
  });
  it('exige le réseau du lien, y compris un hôte inconnu', () => {
    expect(compteSocialCreateSchema.safeParse({ ...input, plateforme: 'tiktok' }).success).toBe(false);
    expect(compteSocialCreateSchema.safeParse({ ...input, lien_url: 'https://example.org/quartier' }).success).toBe(false);
  });
  it('impose une version valide et une modification effective', () => {
    expect(compteSocialUpdateSchema.safeParse({ nom: 'Autre' }).success).toBe(false);
    expect(compteSocialUpdateSchema.safeParse({ version: 0, nom: 'Autre' }).success).toBe(false);
    expect(compteSocialUpdateSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(compteSocialUpdateSchema.safeParse({ version: 1, observations: '' }).success).toBe(true);
  });
  it('verrouille les tris, filtres et limites', () => {
    expect(reseauxSociauxQuerySchema.safeParse({ sort: 'nom; DROP TABLE users' }).success).toBe(false);
    expect(reseauxSociauxQuerySchema.safeParse({ pageSize: '201' }).success).toBe(false);
    expect(reseauxSociauxQuerySchema.safeParse({ q: ['a', 'b'] }).success).toBe(false);
    expect(reseauxSociauxQuerySchema.parse({ actif: '0' })).toMatchObject({ actif: '0', page: 1, pageSize: 25 });
  });
});
