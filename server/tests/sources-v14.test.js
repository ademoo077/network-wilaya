import { beforeAll, describe, expect, it } from 'vitest';
import { extraireIdentiteSource } from '@anm/shared';
import { createCompteSocial } from '../src/services/reseauxSociaux.js';
import {
  backfillSourcesV14, identifiantsSource, lierIdentifiant, sourcesParIdentite,
} from '../src/services/sourceIdentifiants.js';
import { DERNIERE_VERSION_MIGRATION, freshDatabase } from './helpers.js';

let db;
let refs;
let userIds;

beforeAll(() => {
  ({ db, refs, userIds } = freshDatabase());
});

describe('V14 — migration 015 et rétro-remplissage', () => {
  it('applique la migration additive et ajoute les objets attendus', () => {
    expect(db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get().v).toBe(DERNIERE_VERSION_MIGRATION);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name);
    expect(tables).toContain('reseaux_identifiants');
    const colonnes = db.prepare("PRAGMA table_info('anomalies')").all().map((row) => row.name);
    expect(colonnes).toContain('source_reseau_id');
    const index = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_anomalies_source_reseau'").get();
    expect(index?.name).toBe('idx_anomalies_source_reseau');
  });

  it('rétro-remplit les identifiants depuis les URL existantes, sans doubler', () => {
    createCompteSocial(db, {
      nom: 'Aintaya News', lien_url: 'https://www.facebook.com/aintaya.news/posts/1/',
      plateforme: 'facebook', categorie: 'page',
    }, userIds.admin);
    createCompteSocial(db, {
      nom: 'Aintaya Instagram', lien_url: 'https://www.instagram.com/aintaya.news/',
      plateforme: 'instagram', categorie: 'profil',
    }, userIds.admin);

    const premier = backfillSourcesV14(db);
    expect(premier.identifiants).toBeGreaterThanOrEqual(2);
    const second = backfillSourcesV14(db);
    expect(second).toEqual({ identifiants: 0, rattachees: 0 });

    const facebook = db.prepare("SELECT id FROM comptes_sociaux WHERE lien_url LIKE '%facebook%'").get();
    const identifiants = identifiantsSource(db, facebook.id);
    expect(identifiants).toEqual([expect.objectContaining({
      reseau: 'facebook', type: 'slug', valeur: 'aintaya.news', valeur_norm: 'aintaya.news',
    })]);
    const instagram = db.prepare("SELECT id FROM comptes_sociaux WHERE plateforme='instagram'").get();
    expect(identifiantsSource(db, instagram.id)).toEqual([expect.objectContaining({
      reseau: 'instagram', type: 'handle', valeur: 'aintaya.news', valeur_norm: 'aintaya.news',
    })]);
  });

  it('rattache les anomalies déjà liées à une page connue', () => {
    const source = db.prepare("SELECT id FROM comptes_sociaux WHERE plateforme='facebook'").get();
    db.prepare(`INSERT INTO anomalies(reference, plateforme, lien_url, lien_normalise, date_signalement,
      domaine_id, type_id, daira_id, commune_id, saisi_par, search_norm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('V14-001', 'facebook', 'https://www.facebook.com/aintaya.news',
        'https://facebook.com/aintaya.news', '2026-11-01', refs.domaineId, refs.typeId,
        refs.dairaId, refs.communeId, userIds.admin, 'v14 test');
    const resultat = backfillSourcesV14(db);
    expect(resultat.rattachees).toBe(1);
    expect(db.prepare('SELECT source_reseau_id FROM anomalies WHERE reference=?').get('V14-001').source_reseau_id).toBe(source.id);
    expect(backfillSourcesV14(db).rattachees).toBe(0);
  });

  it('reconnaît une URL de publication par l’identifiant rétro-rempli', () => {
    const identite = extraireIdentiteSource('https://m.facebook.com/aintaya.news/videos/987/?fbclid=x');
    const sources = sourcesParIdentite(db, identite);
    expect(sources).toHaveLength(1);
    expect(sources[0].nom).toBe('Aintaya News');
    expect(sourcesParIdentite(db, extraireIdentiteSource('https://www.facebook.com/share/p/19S9HP1xWn/'))).toEqual([]);
  });

  it('garantit l’unicité d’un identifiant et la suppression en cascade', () => {
    const source = db.prepare("SELECT id FROM comptes_sociaux WHERE plateforme='facebook'").get();
    const autre = db.prepare("SELECT id FROM comptes_sociaux WHERE plateforme='instagram'").get();
    expect(() => lierIdentifiant(db, {
      sourceId: autre.id, reseau: 'facebook', type: 'slug', valeur: 'AINTAYA.NEWS',
    })).toThrow();
    const ajout = lierIdentifiant(db, {
      sourceId: source.id, reseau: 'facebook', type: 'id', valeur: '101010', userId: userIds.admin,
    });
    expect(ajout.created).toBe(true);
    expect(lierIdentifiant(db, {
      sourceId: source.id, reseau: 'facebook', type: 'id', valeur: '101010', userId: userIds.admin,
    }).created).toBe(false);
    db.prepare('DELETE FROM comptes_sociaux WHERE id=?').run(source.id);
    expect(identifiantsSource(db, source.id)).toEqual([]);
  });
});
