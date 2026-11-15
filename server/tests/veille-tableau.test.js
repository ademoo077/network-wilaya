import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../src/app.js';
import { freshDatabase, login, write } from './helpers.js';
import { computePeaks, veilleDashboard } from '../src/veille/stats.js';
import { generateAlerts, listAlerts } from '../src/veille/alerts.js';

const NOW = new Date('2026-11-12T12:00:00.000Z');
const DAY = 86400000;
let app; let db; let admin; let sourceId; let groupId; let communeId; let seq = 0;

function insertElement({
  collecte = '2026-11-12T08:00:00.000Z', statut = 'a_qualifier', score = 6, viralite = null,
  texte = null, datePublication = null, traiteLe = null, commune = null, group = null, url = null,
} = {}) {
  seq += 1;
  const id = Number(db.prepare(`INSERT INTO veille_elements
    (source_id, id_externe, url, texte, texte_norm, collecte_le, statut, score, viralite,
     date_publication, traite_le)
    VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?)`).run(
    sourceId, `tableau-${seq}`, url, texte || `Signalement ${seq}`,
    collecte, statut, score, viralite, datePublication, traiteLe,
  ).lastInsertRowid);
  db.prepare(`INSERT INTO veille_suggestions(element_id, rang, groupe_id, commune_id, score, priorite)
    VALUES (?, 1, ?, ?, ?, 'normale')`).run(id, group ?? groupId, commune ?? communeId, score);
  return id;
}

beforeAll(async () => {
  ({ db } = freshDatabase());
  app = createApp();
  admin = await login(app, 'admin');
  groupId = Number(db.prepare('SELECT id FROM groupes_domaines ORDER BY id LIMIT 1').get().id);
  communeId = Number(db.prepare('SELECT id FROM communes ORDER BY id LIMIT 1').get().id);
  sourceId = Number(db.prepare(`INSERT INTO veille_sources(type, nom, actif, frequence_min, dernier_statut)
    VALUES ('import', 'Tableau E2E', 1, 1440, 'error')`).run().lastInsertRowid);
  db.prepare(`UPDATE veille_sources SET jeton_expire_le = '2026-11-14T00:00:00.000Z' WHERE id = ?`).run(sourceId);
});

describe('Tableau de veille — agrégations', () => {
  it('calcule les totaux, la qualité, les séries et la santé des sources', () => {
    db.prepare('DELETE FROM veille_elements').run();
    insertElement({ statut: 'retenu', score: 10, viralite: 42, datePublication: '2026-11-12T00:00:00.000Z', traiteLe: '2026-11-12T06:00:00.000Z' });
    insertElement({ collecte: '2026-11-11T08:00:00.000Z', statut: 'rejete', score: 1 });
    insertElement({ collecte: '2026-11-10T08:00:00.000Z', statut: 'ignore', score: 5 });
    insertElement({ collecte: '2026-11-09T08:00:00.000Z', statut: 'a_qualifier', score: 1 });

    const data = veilleDashboard(db, { days: 30, now: NOW });
    expect(data.totaux).toMatchObject({
      collectes: 4, retenus: 1, rejetes: 1, ignores: 1, a_qualifier: 1, pertinents: 2,
    });
    expect(data.par_jour).toHaveLength(30);
    expect(data.par_jour.at(-1)).toMatchObject({ jour: '2026-11-12', collectes: 1, retenus: 1 });
    expect(data.par_source.find((row) => row.id === sourceId)).toMatchObject({ collectes: 4, retenus: 1 });
    expect(data.qualite.precision_estimee).toBe(0.5);
    expect(data.qualite.rappel_estime).toBe(0.5);
    expect(data.qualite.delai_median_heures).toBe(6);
    expect(data.viral).toHaveLength(1);
    expect(data.sante_sources.find((row) => row.id === sourceId)).toMatchObject({ dernier_statut: 'error' });
  });

  it('détecte un pic par groupe × commune avec un z-score ≥ 2', () => {
    db.prepare('DELETE FROM veille_elements').run();
    const end = new Date(NOW); end.setUTCHours(0, 0, 0, 0);
    for (let day = 0; day < 35; day += 1) {
      const count = day < 7 ? 6 : (day % 2 === 0 ? 1 : 0);
      const dayIso = new Date(end.getTime() - day * DAY + 8 * 3600000).toISOString();
      for (let index = 0; index < count; index += 1) insertElement({ collecte: dayIso, statut: 'a_qualifier' });
    }
    const peaks = computePeaks(db, { now: NOW });
    expect(peaks.length).toBeGreaterThan(0);
    expect(peaks[0]).toMatchObject({ groupe_id: groupId, commune_id: communeId, total_7j: 42 });
    expect(peaks[0].z).toBeGreaterThanOrEqual(2);
    const data = veilleDashboard(db, { days: 30, now: NOW });
    expect(data.pics.length).toBeGreaterThan(0);
  });

  it('expose le tableau via l’API pour les rôles autorisés', async () => {
    const response = await admin.agent.get('/api/veille/tableau?jours=7');
    expect(response.status).toBe(200);
    expect(response.body.item.periode.jours).toBe(7);
    expect(response.body.item.par_jour).toHaveLength(7);
  });
});

describe('Alertes — génération, déduplication et lecture', () => {
  it('génère les alertes de source, jeton, attente, terme critique, viralité et pic', () => {
    db.prepare('DELETE FROM veille_alertes').run();
    const old = new Date(NOW.getTime() - 3 * DAY).toISOString();
    insertElement({ collecte: old, statut: 'a_qualifier', texte: 'Signalement ancien en attente' });
    const criticalId = insertElement({ collecte: '2026-11-12T09:00:00.000Z', statut: 'a_qualifier', texte: 'Risque d’effondrement signalé' });
    const urgence = db.prepare("SELECT id FROM veille_lexique WHERE role = 'urgence' AND actif = 1 LIMIT 1").get();
    if (urgence) db.prepare('INSERT OR IGNORE INTO veille_correspondances(element_id, terme_id, occurrences, poids_total) VALUES (?, ?, 1, 3)').run(criticalId, urgence.id);
    for (let index = 0; index < 6; index += 1) {
      insertElement({ statut: 'a_qualifier', viralite: 10 + index });
    }
    const created = generateAlerts(db, { now: NOW });
    expect(created).toBeGreaterThan(0);
    const regles = new Set(listAlerts(db, { limit: 100 }).map((item) => item.regle));
    expect(regles.has('source_erreur')).toBe(true);
    expect(regles.has('jeton_expiration')).toBe(true);
    expect(regles.has('attente_qualification')).toBe(true);
    expect(regles.has('publication_virale')).toBe(true);
    expect(regles.has('pic_activite')).toBe(true);
    if (urgence) expect(regles.has('terme_critique')).toBe(true);

    expect(generateAlerts(db, { now: NOW })).toBe(0);
  });

  it('liste, marque lue et marque tout lu via l’API', async () => {
    const list = await admin.agent.get('/api/veille/alertes?non_lues=1');
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThan(0);
    const first = list.body.items[0];
    const read = await write(admin.agent, admin.csrf, 'post', `/api/veille/alertes/${first.id}/lue`);
    expect(read.status).toBe(200);
    const all = await write(admin.agent, admin.csrf, 'post', '/api/veille/alertes/tout-lues');
    expect(all.status).toBe(200);
    const unread = await admin.agent.get('/api/veille/alertes?non_lues=1');
    expect(unread.body.items).toHaveLength(0);
  });
});
