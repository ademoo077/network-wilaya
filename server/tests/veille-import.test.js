import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { freshDatabase, login } from './helpers.js';
import {
  importElements, parseCsv, parseImport, parseJson, parseWhatsapp,
} from '../src/veille/import.js';

let app; let db; let admin; let operator;

beforeAll(async () => {
  ({ db } = freshDatabase());
  app = createApp();
  admin = await login(app, 'admin');
  operator = await login(app, 'operateur');
});

describe('Import — analyse des fichiers', () => {
  it('lit un CSV avec en-têtes, délimiteur point-virgule et champs entre guillemets', () => {
    const csv = 'texte;url;page;date\n"Fuite d\'eau, rue Didouche";https://exemple.dz/a;Page Alger;2026-11-10\n'
      + 'Déchets à Bab El Oued;https://exemple.dz/b;Page Alger;2026-11-11\n';
    const { items, truncated } = parseCsv(csv);
    expect(truncated).toBe(false);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      texte: 'Fuite d\'eau, rue Didouche', url: 'https://exemple.dz/a', page_nom: 'Page Alger',
    });
  });

  it('lit un CSV sans en-tête, texte puis URL, et extrait une URL du texte', () => {
    const { items } = parseCsv('Trou sur la chaussée à Alger Centre\n'
      + 'Voir https://exemple.dz/signalement toujours pas réparé\n');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ texte: 'Trou sur la chaussée à Alger Centre', url: null });
    expect(items[1].url).toBe('https://exemple.dz/signalement');
  });

  it('lit un JSON tableau ou enveloppé et ignore les entrées vides', () => {
    const payload = JSON.stringify({ items: [
      { message: 'Lampadaire en panne', lien: 'https://exemple.dz/l', page: 'Page Alger', date: '2026-11-09' },
      { message: '   ' },
      'ignoré',
    ] });
    const { items } = parseJson(payload);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ texte: 'Lampadaire en panne', url: 'https://exemple.dz/l', date_publication: '2026-11-09' });
  });

  it('lit un export WhatsApp multiligne, convertit la date et ignore les messages système', () => {
    const text = [
      '12/11/2026, 08:15 - Messages et appels chiffrés',
      '[12/11/2026, 08:16:03] Citoyen A: Fuite d\'eau rue Didouche',
      'Toujours pas réparée https://exemple.dz/fuite',
      '[12/11/2026, 08:17] Citoyen B: a changé le sujet',
      '[12/11/2026, 08:18] Citoyen C: Déchets devant l\'école',
    ].join('\n');
    const { items } = parseWhatsapp(text);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      date_publication: '2026-11-12', url: 'https://exemple.dz/fuite',
    });
    expect(items[0].texte).toContain('Toujours pas réparée');
    expect(items[1].texte).toBe('Déchets devant l\'école');
  });

  it('borne le volume et le format', () => {
    const rows = ['texte,url'];
    for (let index = 0; index < 20005; index += 1) rows.push(`Signalement ${index},https://exemple.dz/${index}`);
    const { items, truncated } = parseCsv(rows.join('\n'));
    expect(truncated).toBe(true);
    expect(items).toHaveLength(20000);
    expect(() => parseImport('x', 'pdf')).toThrow(/Format d’import invalide/);
    expect(() => parseImport('   ', 'csv')).toThrow(/Fichier vide/);
    expect(() => parseImport(`texte\n${'a'.repeat(5 * 1024 * 1024)}`, 'csv')).toThrow(/trop volumineux/);
  });
});

describe('Import — intégration Veille', () => {
  it('crée les éléments analysés dans une source « import » inactive et reste idempotent', () => {
    const csv = 'texte,url\nFuite d\'eau à Alger Centre,https://exemple.dz/import/1\n'
      + 'Dépôt sauvage à Bab El Oued,https://exemple.dz/import/2\n';
    const first = importElements(db, { text: csv, format: 'csv', nom: 'Fichier E2E' });
    expect(first).toMatchObject({ total: 2, collected: 2, newCount: 2, duplicates: 0, ignored: 0, truncated: false });
    const source = db.prepare('SELECT * FROM veille_sources WHERE id = ?').get(first.source_id);
    expect(source).toMatchObject({ type: 'import', nom: 'Fichier E2E', actif: 0 });

    const second = importElements(db, { text: csv, format: 'csv', nom: 'Fichier E2E' });
    expect(second).toMatchObject({ newCount: 0, duplicates: 2 });
    const count = db.prepare('SELECT COUNT(*) AS c FROM veille_elements WHERE source_id = ?').get(first.source_id).c;
    expect(count).toBe(2);
    const analyzed = db.prepare('SELECT COUNT(*) AS c FROM veille_elements WHERE source_id = ? AND score > 0').get(first.source_id).c;
    expect(analyzed).toBeGreaterThan(0);
  });

  it('refuse un import sans authentification ou avec un rôle insuffisant', async () => {
    const csv = 'texte,url\nFuite,https://exemple.dz/import/auth\n';
    const anonymous = await request(app).post('/api/veille/import?format=csv')
      .set('Content-Type', 'text/plain').send(csv);
    expect(anonymous.status).toBe(401);

    const denied = await operator.agent.post('/api/veille/import?format=csv')
      .set('X-CSRF-Token', operator.csrf).set('Content-Type', 'text/plain').send(csv);
    expect(denied.status).toBe(403);
  });

  it('accepte un corps texte et expose le bilan d’import', async () => {
    const csv = 'texte,url,date\nNid de poule avenue Pasteur,https://exemple.dz/import/3,2026-11-12\n';
    const response = await admin.agent.post('/api/veille/import?format=csv&nom=Import%20route')
      .set('X-CSRF-Token', admin.csrf).set('Content-Type', 'text/plain').send(csv);
    expect(response.status).toBe(200);
    expect(response.body.item).toMatchObject({
      format: 'csv', total: 1, newCount: 1, duplicates: 0, truncated: false,
    });
    const element = db.prepare('SELECT * FROM veille_elements WHERE url = ?').get('https://exemple.dz/import/3');
    expect(element).toBeTruthy();
    expect(element.date_publication).toBe('2026-11-12');
    expect(element.url_normalise).toContain('exemple.dz');
  });

  it('rejette un format inconnu avec un message explicite', async () => {
    const response = await admin.agent.post('/api/veille/import?format=pdf')
      .set('X-CSRF-Token', admin.csrf).set('Content-Type', 'text/plain').send('contenu');
    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/Format d’import invalide/);
  });
});
