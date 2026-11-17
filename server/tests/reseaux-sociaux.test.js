import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it } from 'vitest';
import { compteSocialItemSchema, reseauxSociauxListSchema, reseauxSociauxQuerySchema, reseauxSociauxStatsSchema } from '@anm/shared';
import { config } from '../src/config/index.js';
import { createApp } from '../src/app.js';
import { freshDatabase, login, TEST_PASSWORD, write } from './helpers.js';
import { createCompteSocial, getCompteSocial, listComptesSociaux, updateCompteSocial } from '../src/services/reseauxSociaux.js';
import { statsReseauxSociaux } from '../src/services/statsReseauxSociaux.js';
import { exportReseauxSociaux } from '../src/services/exportReseauxSociaux.js';
import { createSocialImportPreview, importComptesSociaux, parseSocialWorkbook, previewSocialImport, suppliedSocialSource } from '../src/services/importReseauxSociaux.js';
import { importTerritoire } from '../src/services/territoireImport.js';

let db; let refs; let userIds; let app;
beforeEach(() => { ({ db, refs, userIds } = freshDatabase()); app = createApp(); });
const query = (value = {}) => reseauxSociauxQuerySchema.parse(value);
const payload = (value = {}) => ({ nom: '[DEMO] Page environnement', lien_url: 'https://facebook.com/demo.environnement', plateforme: 'facebook', categorie: 'page',
  daira_id: refs.dairaId, commune_id: refs.communeId, ...value });
const source = (lignes) => ({ fichier: 'tableau-test.xlsx', feuille: 'LIEN', lignes: lignes.map((row, index) => ({ ligne: index + 3,
  ca: 'Daïra Test', commune: 'Commune Test', lien: '', nom: '', autres: '', nom_autres: '', ...row })) });

describe('API du répertoire social', () => {
  it('protège toute lecture et réserve toutes les écritures aux administrateurs', async () => {
    expect((await request(app).get('/api/reseaux-sociaux')).status).toBe(401);
    for (const path of ['/api/reseaux-sociaux/stats', '/api/reseaux-sociaux/export', '/api/reseaux-sociaux/1']) {
      const anonymous = await request(app).get(path);
      expect(anonymous.status).toBe(401); expect(anonymous.body.error.code).toBe('UNAUTHORIZED');
    }
    for (const role of ['lecteur', 'operateur']) {
      const { agent, csrf } = await login(app, role);
      expect((await agent.get('/api/reseaux-sociaux')).status).toBe(200);
      expect((await agent.get('/api/reseaux-sociaux/stats')).status).toBe(200);
      expect((await write(agent, csrf, 'post', '/api/reseaux-sociaux', payload())).status).toBe(403);
      expect((await write(agent, csrf, 'patch', '/api/reseaux-sociaux/1', { version: 1, nom: 'interdit' })).status).toBe(403);
      expect((await write(agent, csrf, 'post', '/api/reseaux-sociaux/import/fourni')).status).toBe(403);
      expect((await write(agent, csrf, 'post', '/api/reseaux-sociaux/import/preview')).status).toBe(403);
      expect((await write(agent, csrf, 'post', '/api/reseaux-sociaux/import/commit', { importId: '00000000-0000-4000-8000-000000000000' })).status).toBe(403);
    }
  });
  it('exige le CSRF et renvoie les erreurs de validation structurées', async () => {
    const { agent, csrf } = await login(app);
    expect((await agent.post('/api/reseaux-sociaux').send(payload())).status).toBe(403);
    const invalid = await write(agent, csrf, 'post', '/api/reseaux-sociaux', payload({ nom: '' }));
    expect(invalid.status).toBe(400); expect(invalid.body.error.fields.nom).toBeTruthy();
    expect((await agent.get('/api/reseaux-sociaux?sort=sql')).status).toBe(400);
  });
  it('crée, corrige et désactive sans effacer la fiche ; la réponse respecte les contrats', async () => {
    const { agent, csrf } = await login(app);
    const created = await write(agent, csrf, 'post', '/api/reseaux-sociaux', payload());
    expect(created.status).toBe(201); expect(compteSocialItemSchema.safeParse(created.body).success).toBe(true);
    const edited = await write(agent, csrf, 'patch', `/api/reseaux-sociaux/${created.body.item.id}`, { version: 1, nom: '[DEMO] Nom corrigé', observations: 'Déchets et eau', verification: 'verifie', actif: 0 });
    expect(edited.status).toBe(200); expect(edited.body.item).toMatchObject({ version: 2, nom: '[DEMO] Nom corrigé', actif: 0, verification: 'verifie' });
    const list = await agent.get('/api/reseaux-sociaux?actif=0');
    expect(reseauxSociauxListSchema.safeParse(list.body).success).toBe(true); expect(list.body.total).toBe(1);
    expect((await agent.delete(`/api/reseaux-sociaux/${created.body.item.id}`).set('X-CSRF-Token', csrf)).status).toBe(404);
    expect(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action IN ('RESEAUX_SOCIAUX_CREATE','RESEAUX_SOCIAUX_UPDATE')").get().n).toBe(2);
  });
  it('ne contourne jamais un conflit de version', async () => {
    const { agent, csrf } = await login(app);
    const item = createCompteSocial(db, payload(), userIds.admin);
    updateCompteSocial(db, item.id, { version: 1, nom: '[DEMO] Autre administrateur' }, userIds.admin);
    const stale = await write(agent, csrf, 'patch', `/api/reseaux-sociaux/${item.id}`, { version: 1, nom: 'Écrasement' });
    expect(stale.status).toBe(409); expect(stale.body.error.code).toBe('VERSION_CONFLICT');
    expect(getCompteSocial(db, item.id).nom).toBe('[DEMO] Autre administrateur');
  });
  it('refuse les doublons normalisés, même parmi les comptes désactivés', async () => {
    const { agent, csrf } = await login(app);
    const item = createCompteSocial(db, payload({ actif: 0 }), userIds.admin);
    const duplicate = await write(agent, csrf, 'post', '/api/reseaux-sociaux', payload({ lien_url: 'http://m.facebook.com/DEMO.ENVIRONNEMENT/?fbclid=xyz' }));
    expect(duplicate.status).toBe(409); expect(duplicate.body.error.details.id).toBe(item.id);
    expect(db.prepare('SELECT COUNT(*) AS n FROM comptes_sociaux').get().n).toBe(1);
  });
  it('refuse les incohérences territoriales et réseau, sans modifier les référentiels', async () => {
    const { agent, csrf } = await login(app);
    const result = await write(agent, csrf, 'post', '/api/reseaux-sociaux', payload({ commune_id: refs.otherCommuneId }));
    expect(result.status).toBe(422); expect(result.body.error.fields.commune_id).toBeTruthy();
    expect((await write(agent, csrf, 'post', '/api/reseaux-sociaux', payload({ plateforme: 'instagram' }))).status).toBe(400);
    expect(db.prepare('SELECT COUNT(*) AS n FROM communes').get().n).toBe(2);
  });
  it('renvoie une erreur explicite pour une fiche introuvable', async () => {
    const { agent } = await login(app, 'lecteur');
    expect((await agent.get('/api/reseaux-sociaux/99999')).status).toBe(404);
    expect((await agent.get('/api/reseaux-sociaux/abc')).status).toBe(400);
  });
});

describe('Import LIEN additif', () => {
  it('conserve noms et vrais hyperliens Excel, propage le CA et ignore les autres feuilles', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Contacts').addRow(['ne pas importer']);
    const sheet = workbook.addWorksheet('LIEN');
    sheet.getRow(2).values = ['CA', 'COMMUNES', 'lien', '', 'autres'];
    sheet.getRow(3).values = ['Daïra Test', 'Commune Test', { text: 'https://facebook.com/affichage', hyperlink: 'https://facebook.com/cible' },
      { text: '[DEMO] Nom arabe اسم', hyperlink: 'https://facebook.com/cible' }, 'https://tiktok.com/@demo/video/123', '[DEMO] Profil'];
    sheet.getRow(4).values = ['', 'Commune Test', 'https://facebook.com/groups/456', '[DEMO] Groupe'];
    sheet.getRow(5).values = ['', 'Commune Test'];
    const parsed = await parseSocialWorkbook({ originalname: 'repertoire.xlsx', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) });
    expect(parsed.lignes[0]).toMatchObject({ nom: '[DEMO] Nom arabe اسم', lien: 'https://facebook.com/cible' });
    expect(parsed.lignes[1].ca).toBe('Daïra Test');
    const preview = previewSocialImport(db, parsed);
    expect(preview.summary).toMatchObject({ total: 3, nouveaux: 3, sans_lien: 1, erreurs: 0 });
    expect(preview.rows.map((row) => row.categorie)).toEqual(['page', 'profil', 'groupe']);
  });
  it('extrait exactement les 95 liens fournis sans inventer la commune ni le nom absent', () => {
    importTerritoire(db, JSON.parse(fs.readFileSync(new URL('../../seed/territoire-alger.json', import.meta.url))), { commit: true });
    const input = suppliedSocialSource();
    const preview = previewSocialImport(db, input);
    expect(preview.summary).toEqual({ total: 95, nouveaux: 95, existants: 0, doublons: 0, erreurs: 0, sans_lien: 4, a_verifier: 95 });
    expect(preview.rows.filter((row) => row.categorie === 'groupe')).toHaveLength(6);
    expect(preview.rows.filter((row) => row.categorie === 'profil')).toHaveLength(10);
    expect(preview.rows.filter((row) => row.plateforme === 'tiktok')).toHaveLength(1);
    expect(preview.rows.find((row) => row.ligne === 36 && row.colonne === 'C')).toMatchObject({ nom: '', commune_id: null, ca_libelle: 'DAR EL BEIDA', commune_libelle: 'MOHAMADIA' });
    expect(preview.rows.find((row) => row.ligne === 81)).toMatchObject({ commune_id: null, commune_libelle: 'SIDI ABDELLAH' });
    expect(preview.rows.filter((row) => !row.commune_id).map((row) => `${row.ligne}:${row.colonne}`)).toEqual(['36:C', '40:C', '81:C', '82:C']);
    expect(preview.rows.find((row) => row.ligne === 51).commune_id).not.toBeNull();
    expect(preview.rows.find((row) => row.ligne === 25).nom).toBe('بوجمعة تميم درارية');
    const result = importComptesSociaux(db, input);
    expect(result.created).toBe(95);
    expect(db.prepare('SELECT COUNT(*) AS n FROM communes').get().n).toBe(59);
    const stats = statsReseauxSociaux(db, query());
    expect(stats.resume).toMatchObject({ total: 95, pages: 79, profils: 10, groupes: 6, reseaux: 2 });
    expect(stats.ca.reduce((sum, row) => sum + row.total, 0)).toBe(95);
    expect(stats.communes.reduce((sum, row) => sum + row.total, 0)).toBe(95);
  });
  it('n’écrase ni une correction administrateur, ni une désactivation à la relance', () => {
    const input = source([{ lien: 'https://facebook.com/demo.environnement', nom: '[DEMO] Nom initial' }]);
    const first = importComptesSociaux(db, input, userIds.admin);
    updateCompteSocial(db, first.ids[0], { version: 1, nom: '[DEMO] Nom corrigé', actif: 0, observations: 'Conserver', verification: 'verifie' }, userIds.admin);
    expect(importComptesSociaux(db, input).created).toBe(0);
    expect(getCompteSocial(db, first.ids[0])).toMatchObject({ nom: '[DEMO] Nom corrigé', actif: 0, observations: 'Conserver', verification: 'verifie', version: 2, nom_source: '[DEMO] Nom initial' });
  });
  it('signale les liens invalides et les doublons internes, sans créer de fausses fiches', () => {
    const input = source([{ lien: 'https://facebook.com/demo.environnement', nom: '[DEMO] Page' },
      { lien: 'http://m.facebook.com/DEMO.ENVIRONNEMENT?fbclid=abc', nom: '[DEMO] Doublon' }, { autres: 'javascript:alert(1)', nom_autres: 'Invalide' }]);
    expect(previewSocialImport(db, input).summary).toMatchObject({ total: 3, nouveaux: 1, doublons: 1, erreurs: 1 });
    expect(importComptesSociaux(db, input)).toMatchObject({ created: 1, skipped: 2 });
  });
  it('garde la source immuable dans une modification API', async () => {
    const item = importComptesSociaux(db, source([{ lien: 'https://facebook.com/demo.environnement', nom: '[DEMO] Source' }]), userIds.admin);
    const { agent, csrf } = await login(app);
    expect((await write(agent, csrf, 'patch', `/api/reseaux-sociaux/${item.ids[0]}`, { version: 1, nom_source: 'source falsifiée' })).status).toBe(400);
  });
  it('permet de corriger une fiche importée sans inventer son nom absent', async () => {
    const imported = importComptesSociaux(db, source([{ lien: 'https://facebook.com/groups/987' }]), userIds.admin);
    const { agent, csrf } = await login(app);
    const edited = await write(agent, csrf, 'patch', `/api/reseaux-sociaux/${imported.ids[0]}`, { version: 1, actif: 0, observations: 'Nom encore inconnu' });
    expect(edited.status).toBe(200); expect(edited.body.item).toMatchObject({ nom: '', actif: 0, version: 2, verification: 'a_verifier', nom_source: '' });
    const verified = await write(agent, csrf, 'patch', `/api/reseaux-sociaux/${imported.ids[0]}`, { version: 2, verification: 'verifie' });
    expect(verified.status).toBe(422); expect(verified.body.error.fields.nom).toBeTruthy();
  });
  it('lie l’aperçu à son administrateur, expire et applique une seule fois', async () => {
    const preview = createSocialImportPreview(db, source([{ lien: 'https://facebook.com/demo.environnement', nom: '[DEMO] Page' }]), userIds.admin);
    db.prepare("INSERT INTO users(username,full_name,password_hash,role,actif,must_change_password) SELECT 'autre_admin','Autre admin',password_hash,'admin',1,0 FROM users WHERE id=?").run(userIds.admin);
    const other = request.agent(app); const session = await other.post('/api/auth/login').send({ username: 'autre_admin', password: TEST_PASSWORD });
    expect((await write(other, session.body.csrf, 'post', '/api/reseaux-sociaux/import/commit', { importId: preview.importId })).status).toBe(403);
    const { agent, csrf } = await login(app);
    const first = await write(agent, csrf, 'post', '/api/reseaux-sociaux/import/commit', { importId: preview.importId });
    expect(first.status).toBe(200); expect(first.body.item).toMatchObject({ created: 1, deja_applique: false });
    const again = await write(agent, csrf, 'post', '/api/reseaux-sociaux/import/commit', { importId: preview.importId });
    expect(again.body.item).toMatchObject({ created: 1, deja_applique: true });
    expect(db.prepare('SELECT COUNT(*) AS n FROM comptes_sociaux').get().n).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='RESEAUX_SOCIAUX_IMPORT'").get().n).toBe(1);
    const expired = createSocialImportPreview(db, source([{ lien: 'https://facebook.com/autre', nom: 'Autre' }]), userIds.admin);
    const file = path.join(config.tmpDir, `reseaux-import-${expired.importId}.json`);
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')); saved.expiresAt = '2000-01-01T00:00:00.000Z'; fs.writeFileSync(file, JSON.stringify(saved));
    expect((await write(agent, csrf, 'post', '/api/reseaux-sociaux/import/commit', { importId: expired.importId })).status).toBe(400);
  });
  it('revérifie les doublons apparus depuis l’aperçu', async () => {
    const preview = createSocialImportPreview(db, source([{ lien: 'https://facebook.com/demo.environnement', nom: '[DEMO] Import' }]), userIds.admin);
    createCompteSocial(db, payload({ nom: '[DEMO] Ajout manuel' }), userIds.admin);
    const { agent, csrf } = await login(app);
    const result = await write(agent, csrf, 'post', '/api/reseaux-sociaux/import/commit', { importId: preview.importId });
    expect(result.body.item).toMatchObject({ created: 0, skipped: 1 });
    expect(listComptesSociaux(db, query()).items[0].nom).toBe('[DEMO] Ajout manuel');
  });
});

describe('Statistiques et exports contractuels', () => {
  function populate() {
    createCompteSocial(db, payload(), userIds.admin);
    createCompteSocial(db, payload({ nom: '[DEMO] Page 2', lien_url: 'https://facebook.com/demo.deux', actif: 0 }), userIds.admin);
    createCompteSocial(db, payload({ nom: '[DEMO] Profil اسم', lien_url: 'https://tiktok.com/@demo', plateforme: 'tiktok', categorie: 'profil',
      daira_id: refs.otherDairaId, commune_id: refs.otherCommuneId, verification: 'verifie' }), userIds.admin);
  }
  it('gère la base vide et les communes sans compte, sans faux pourcentage', async () => {
    const { agent } = await login(app);
    const result = await agent.get('/api/reseaux-sociaux/stats');
    expect(result.status).toBe(200); expect(reseauxSociauxStatsSchema.safeParse(result.body).success).toBe(true);
    expect(result.body.item.resume).toMatchObject({ total: 0, pages: 0, profils: 0, communes_sans_compte: 2, couverture: 0 });
    expect(result.body.item.communes).toHaveLength(2);
  });
  it('utilise tous les comptes, pas seulement la page de liste, et les mêmes filtres', () => {
    populate();
    const listing = listComptesSociaux(db, query({ pageSize: 1, page: 2 }));
    const stats = statsReseauxSociaux(db, query({ pageSize: 1, page: 2 }));
    expect(listing.items).toHaveLength(1); expect(stats.resume.total).toBe(listing.total); expect(stats.resume.total).toBe(3);
    for (const filters of [{ actif: '1' }, { plateforme: 'tiktok' }, { categorie: 'profil' }, { daira_id: refs.dairaId }, { q: 'اسم' }, { q: '%_SQL' }]) {
      expect(statsReseauxSociaux(db, query(filters)).resume.total).toBe(listComptesSociaux(db, query(filters)).total);
    }
    expect(statsReseauxSociaux(db, query({ actif: '1' })).resume).toMatchObject({ total: 2, pages: 1, profils: 1, communes_couvertes: 2 });
    expect(stats.reseaux.reduce((sum, row) => sum + row.pourcentage, 0)).toBe(100);
  });
  it('recherche les noms arabes/français et observations sans interpréter les jokers', () => {
    createCompteSocial(db, payload({ nom: '[DEMO] Écologie اسم', observations: 'déchets 50%_tri' }), userIds.admin);
    expect(listComptesSociaux(db, query({ q: 'ecologie' })).total).toBe(1);
    expect(listComptesSociaux(db, query({ q: 'اسم' })).total).toBe(1);
    expect(listComptesSociaux(db, query({ q: '%_tri' })).total).toBe(1);
    expect(listComptesSociaux(db, query({ q: '%_autre' })).total).toBe(0);
  });
  it('ne fait pas disparaître les fiches rattachées à un territoire désactivé et garde une couverture valide', () => {
    populate();
    db.prepare('UPDATE communes SET actif=0 WHERE id=?').run(refs.otherCommuneId);
    db.prepare('UPDATE dairas SET actif=0 WHERE id=?').run(refs.otherDairaId);
    const stats = statsReseauxSociaux(db, query());
    expect(stats.resume).toMatchObject({ total: 3, communes_couvertes: 1, communes_referentiel: 1, couverture: 100 });
    expect(stats.ca.reduce((sum, row) => sum + row.total, 0)).toBe(3);
    expect(stats.communes.reduce((sum, row) => sum + row.total, 0)).toBe(3);
    expect(reseauxSociauxStatsSchema.safeParse({ item: stats }).success).toBe(true);
    const inactive = statsReseauxSociaux(db, query({ commune_id: refs.otherCommuneId }));
    expect(inactive.resume).toMatchObject({ total: 1, communes_couvertes: 0, communes_referentiel: 0, couverture: null });
    expect(inactive.communes[0].total).toBe(1);
  });
  it('les liens de détail territorial non rattachés sélectionnent un groupe exact, pas une recherche approximative', () => {
    createCompteSocial(db, payload({ nom: '[DEMO] Rattaché', ca_libelle: 'IGNORÉ', commune_libelle: 'IGNORÉ' }), userIds.admin);
    for (const [suffix, ca_libelle, commune_libelle] of [['a', 'CA A', 'Commune A'], ['b', 'CA B', 'Commune A'], ['c', 'CA A', 'Commune A bis'], ['d', '', '']]) {
      createCompteSocial(db, payload({ nom: `[DEMO] ${suffix}`, lien_url: `https://facebook.com/demo.${suffix}`, daira_id: null, commune_id: null, ca_libelle, commune_libelle }), userIds.admin);
    }
    const filters = query({ non_rattache: 'commune', ca_libelle: 'CA A', commune_libelle: 'Commune A' });
    expect(listComptesSociaux(db, filters).items.map((row) => row.nom)).toEqual(['[DEMO] a']);
    expect(statsReseauxSociaux(db, filters).resume.total).toBe(1);
    expect(listComptesSociaux(db, query({ non_rattache: 'ca', ca_libelle: 'CA A' })).total).toBe(2);
    expect(listComptesSociaux(db, query({ non_rattache: 'commune' })).items.map((row) => row.nom)).toEqual(['[DEMO] d']);
  });
  it('exporte la totalité filtrée, neutralise les formules et inclut les statistiques SQL dans Excel', async () => {
    populate();
    createCompteSocial(db, payload({ nom: '=HYPERLINK("danger")', lien_url: 'https://facebook.com/demo.formule' }), userIds.admin);
    const csv = await exportReseauxSociaux(db, query({ pageSize: 1 }), 'csv');
    expect(csv.count).toBe(4); expect(csv.buffer.toString('utf8')).toContain("'=HYPERLINK");
    const output = await exportReseauxSociaux(db, query({ plateforme: 'facebook', pageSize: 1 }), 'xlsx');
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(output.buffer);
    expect(workbook.getWorksheet('Répertoire').rowCount).toBe(4);
    expect(workbook.getWorksheet('Par réseau').getCell('B2').value).toBe(3);
    expect(workbook.getWorksheet('Par type').getCell('B2').value).toBe(3);
    expect(workbook.getWorksheet('Par commune')).toBeTruthy();
    expect(workbook.getWorksheet('Périmètre').getCell('B3').value).toContain('pas des chiffres d’audience');
    const { agent } = await login(app, 'lecteur');
    const response = await agent.get('/api/reseaux-sociaux/export?format=csv&plateforme=tiktok');
    expect(response.status).toBe(200); expect(response.headers['content-type']).toContain('text/csv'); expect(response.text).toContain('[DEMO] Profil اسم');
    expect(response.text).not.toContain('[DEMO] Page environnement');
  });
});
