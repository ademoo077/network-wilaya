import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../src/app.js';
import { freshDatabase, login, write } from './helpers.js';
import { createVeilleElement } from '../src/veille/ingest.js';
import { veilleContext } from '../src/veille/context.js';
import {
  complianceOverview, eraseElements, maybePurge, purgeExpired,
} from '../src/veille/compliance.js';

let app; let db; let admin; let operator; let lecteur; let sourceId;

function element(texte, url, overrides = {}) {
  const result = createVeilleElement(db, sourceId, {
    texte, url, id_externe: overrides.id_externe || texte, ...overrides,
  }, { context: veilleContext(db) });
  return Number(result.element.id);
}

beforeAll(async () => {
  ({ db } = freshDatabase());
  app = createApp();
  admin = await login(app, 'admin');
  operator = await login(app, 'operateur');
  lecteur = await login(app, 'lecteur');
  sourceId = Number(db.prepare(`INSERT INTO veille_sources(type, nom, actif, frequence_min)
    VALUES ('import', 'Conformité E2E', 0, 1440)`).run().lastInsertRowid);
});

describe('Conformité — purge et effacement', () => {
  it('purge les éléments non retenus échus, anonymise les retenus et conserve les éléments valides', () => {
    const expired = element('Fuite échue', 'https://exemple.dz/conformite/expire');
    const retained = element('Fuite retenue', 'https://exemple.dz/conformite/retenue');
    const valid = element('Fuite valide', 'https://exemple.dz/conformite/valide');
    db.prepare("UPDATE veille_elements SET expire_le = '2026-01-01T00:00:00.000Z' WHERE id IN (?, ?)").run(expired, retained);
    db.prepare("UPDATE veille_elements SET statut = 'retenu', auteur_pseudo = 'pseudo-hmac' WHERE id = ?").run(retained);

    const result = purgeExpired(db, { now: new Date('2026-11-12T10:00:00.000Z') });
    expect(result.supprimes).toBe(1);
    expect(result.anonymises).toBe(1);
    expect(db.prepare('SELECT id FROM veille_elements WHERE id = ?').get(expired)).toBeUndefined();
    expect(db.prepare('SELECT auteur_pseudo FROM veille_elements WHERE id = ?').get(retained).auteur_pseudo).toBeNull();
    expect(db.prepare('SELECT id FROM veille_elements WHERE id = ?').get(valid)).toBeTruthy();
  });

  it('limite la purge automatique à une fois par fenêtre et journalise', () => {
    db.prepare("DELETE FROM parametres WHERE cle = 'veille_derniere_purge'").run();
    const log = { info() {}, warn() {} };
    const first = maybePurge(db, { logger: log, now: new Date('2026-11-12T11:00:00.000Z') });
    expect(first).toBeTruthy();
    const second = maybePurge(db, { logger: log, now: new Date('2026-11-12T12:00:00.000Z') });
    expect(second).toBeNull();
    const expired = element('Purge audit', 'https://exemple.dz/purge/audit');
    db.prepare("UPDATE veille_elements SET expire_le = '2026-01-01T00:00:00.000Z' WHERE id = ?").run(expired);
    const forced = maybePurge(db, { logger: log, now: new Date('2026-11-12T12:01:00.000Z'), force: true });
    expect(forced).toBeTruthy();
    const audit = db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action = 'VEILLE_PURGE'").get().c;
    expect(audit).toBeGreaterThan(0);
  });

  it('efface sur demande par URL normalisée et trace l’action', () => {
    const id = element('Publication à effacer', 'https://www.exemple.dz/effacement?utm_source=test');
    const result = eraseElements(db, {
      url: 'https://exemple.dz/effacement', userId: admin.user.id, username: admin.user.username, motif: 'Demande citoyen',
    });
    expect(result.elements).toBe(1);
    expect(db.prepare('SELECT id FROM veille_elements WHERE id = ?').get(id)).toBeUndefined();
    const trace = db.prepare("SELECT * FROM audit_log WHERE action = 'VEILLE_EFFACEMENT' ORDER BY id DESC LIMIT 1").get();
    expect(trace.username).toBe(admin.user.username);
    expect(trace.details_json).toContain('Demande citoyen');
  });

  it('refuse une demande d’effacement sans correspondance', () => {
    expect(() => eraseElements(db, { url: 'https://exemple.dz/inexistant' })).toThrow(/Aucun élément/);
  });

  it('expose un registre sans secret et les compteurs de conformité', () => {
    const overview = complianceOverview(db);
    expect(overview.parametres).toMatchObject({ conservation_jours: 90, stocker_auteur: false, pseudonymiser_auteurs: true });
    expect(overview.compteurs.sources).toBeGreaterThan(0);
    expect(overview.compteurs.retenus).toBe(1);
    expect(JSON.stringify(overview)).not.toContain('SECRETS_KEY');
  });

  it('protège les routes : lecture pour tous, purge/effacement pour l’admin', async () => {
    const read = await lecteur.agent.get('/api/veille/conformite');
    expect(read.status).toBe(200);
    expect(read.body.item.compteurs).toBeTruthy();

    const denied = await write(operator.agent, operator.csrf, 'post', '/api/veille/effacement', { id: 1 });
    expect(denied.status).toBe(403);
    const deniedPurge = await write(operator.agent, operator.csrf, 'post', '/api/veille/purge');
    expect(deniedPurge.status).toBe(403);

    const invalid = await write(admin.agent, admin.csrf, 'post', '/api/veille/effacement', {});
    expect(invalid.status).toBe(400);

    const id = element('Effacement route', 'https://exemple.dz/effacement-route');
    const erased = await write(admin.agent, admin.csrf, 'post', '/api/veille/effacement', {
      id, motif: 'Test route',
    });
    expect(erased.status).toBe(200);
    expect(erased.body.item.ids).toContain(id);
    expect(db.prepare('SELECT id FROM veille_elements WHERE id = ?').get(id)).toBeUndefined();

    const purged = await write(admin.agent, admin.csrf, 'post', '/api/veille/purge');
    expect(purged.status).toBe(200);
    expect(purged.body.item).toHaveProperty('supprimes');
  });
});
