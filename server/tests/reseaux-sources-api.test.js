import { beforeAll, describe, expect, it } from 'vitest';
import { app, freshDatabase, login, write } from './helpers.js';

let application;
let admin;
let operateur;
let lecteur;

beforeAll(async () => {
  freshDatabase();
  application = app();
  admin = await login(application, 'admin');
  operateur = await login(application, 'operateur');
  lecteur = await login(application, 'lecteur');
});

describe('V14 — API de sélection de page depuis l’URL', () => {
  it('crée une page rapidement et la retourne une seconde fois sans doublon', async () => {
    const corps = {
      reseau: 'facebook', page_url: 'https://facebook.com/aintaya.news',
      nom: 'Aintaya News', nature: 'page',
    };
    const creation = await write(admin.agent, admin.csrf, 'post', '/api/reseaux/rapide', corps);
    expect(creation.status).toBe(201);
    expect(creation.body.item.nom).toBe('Aintaya News');
    expect(creation.body.item.identifiants).toEqual([expect.objectContaining({
      type: 'slug', valeur: 'aintaya.news', valeur_norm: 'aintaya.news',
    })]);
    expect(creation.body.item.verification).toBe('a_verifier');
    expect(creation.body.item.origine).toBe('manuel');

    const retour = await write(admin.agent, admin.csrf, 'post', '/api/reseaux/rapide', corps);
    expect(retour.status).toBe(200);
    expect(retour.body.item.id).toBe(creation.body.item.id);
  });

  it('identifier sélectionne la page existante depuis une URL de publication', async () => {
    const res = await write(admin.agent, admin.csrf, 'post', '/api/reseaux/identifier', {
      url: 'https://m.facebook.com/aintaya.news/posts/987/?fbclid=x',
    });
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('identifie');
    expect(res.body.page_url).toBe('https://facebook.com/aintaya.news');
    expect(res.body.correspondance?.nom).toBe('Aintaya News');
    expect(res.body.similaires).toEqual([]);
    expect(res.body.resolution).toEqual(expect.objectContaining({ tentee: false, ok: false }));
  });

  it('ne devine rien sur un lien de partage', async () => {
    const res = await write(lecteur.agent, lecteur.csrf, 'post', '/api/reseaux/identifier', {
      url: 'https://www.facebook.com/share/p/19S9HP1xWn/',
    });
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('indetermine');
    expect(res.body.correspondance).toBeNull();
    expect(res.body.identifiants).toEqual([]);
    expect(res.body.resolution.tentee).toBe(false);
  });

  it('recherche en normalisant latin et arabe, avec filtre réseau', async () => {
    const arabe = await write(admin.agent, admin.csrf, 'get', '/api/reseaux/recherche?q=%D8%A8%D9%84%D8%AF%D9%8A%D8%A9%20%D8%A7%D8%AE%D8%AA%D8%A8%D8%A7%D8%B1');
    expect(arabe.status).toBe(200);
    expect(Array.isArray(arabe.body.items)).toBe(true);
    const latin = await write(admin.agent, admin.csrf, 'get', '/api/reseaux/recherche?q=Aintaya');
    expect(latin.body.items.map((item) => item.nom)).toContain('Aintaya News');
    const filtre = await write(admin.agent, admin.csrf, 'get', '/api/reseaux/recherche?reseau=facebook&limit=2');
    expect(filtre.body.items).toHaveLength(1);
    expect(filtre.body.items[0].plateforme).toBe('facebook');
  });

  it('lie un second identifiant puis le reconnaît automatiquement', async () => {
    const id = (await write(admin.agent, admin.csrf, 'get', '/api/reseaux/recherche?q=Aintaya')).body.items[0].id;
    const liaison = await write(admin.agent, admin.csrf, 'post', `/api/reseaux/${id}/identifiants`, {
      type: 'id', valeur: '123456',
    });
    expect(liaison.status).toBe(200);
    expect(liaison.body.item.identifiants).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'id', valeur_norm: '123456' }),
    ]));
    const identite = await write(admin.agent, admin.csrf, 'post', '/api/reseaux/identifier', {
      url: 'https://www.facebook.com/profile.php?id=123456',
    });
    expect(identite.body.correspondance?.id).toBe(id);
  });

  it('applique les droits : opérateur crée un groupe mais pas un profil, lecteur ne crée rien', async () => {
    const page = await write(operateur.agent, operateur.csrf, 'post', '/api/reseaux/rapide', {
      reseau: 'facebook', page_url: 'https://facebook.com/groupe-test', nom: 'Groupe Test', nature: 'groupe',
    });
    expect(page.status).toBe(201);
    const profil = await write(operateur.agent, operateur.csrf, 'post', '/api/reseaux/rapide', {
      reseau: 'instagram', page_url: 'https://instagram.com/citoyen-test', nom: 'Citoyen Test', nature: 'profil',
    });
    expect(profil.status).toBe(422);
    expect(profil.body.error.code).toBe('PROFIL_ADMIN_SEULEMENT');
    const lecture = await write(lecteur.agent, lecteur.csrf, 'post', '/api/reseaux/rapide', {
      reseau: 'facebook', page_url: 'https://facebook.com/refuse', nom: 'Refus', nature: 'page',
    });
    expect(lecture.status).toBe(403);
  });

  it('admin crée un profil et refuse un identifiant déjà attaché à une autre page', async () => {
    const profil = await write(admin.agent, admin.csrf, 'post', '/api/reseaux/rapide', {
      reseau: 'instagram', page_url: 'https://instagram.com/citoyen-admin', nom: 'Citoyen Admin', nature: 'profil',
    });
    expect(profil.status).toBe(201);
    const autre = await write(admin.agent, admin.csrf, 'post', '/api/reseaux/rapide', {
      reseau: 'facebook', page_url: 'https://facebook.com/autre-page', nom: 'Autre Page', nature: 'page',
    });
    expect(autre.status).toBe(201);
    const conflit = await write(admin.agent, admin.csrf, 'post', `/api/reseaux/${autre.body.item.id}/identifiants`, {
      type: 'id', valeur: '123456',
    });
    expect(conflit.status).toBe(409);
    expect(conflit.body.error.code).toBe('IDENTIFIANT_DEJA_LIE');
  });
});
