import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeDb, getDb } from '../src/db/index.js';
import { runMigrations, ensureTaxonomy, ensureDomainGroups } from '../src/db/migrate.js';
import { config } from '../src/config/index.js';

export const TEST_PASSWORD = 'Password123!';
export const USERS = {
  admin: { username: 'admin_test', full_name: 'Admin Test', role: 'admin' },
  operateur: { username: 'operateur_test', full_name: 'Opérateur Test', role: 'operateur' },
  lecteur: { username: 'lecteur_test', full_name: 'Lecteur Test', role: 'lecteur' },
};

function removeDbFiles() {
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(`${config.dbPath}${suffix}`); } catch { /* absent */ }
  }
}

/** Recrée une base isolée, migrée, avec taxonomie, utilisateurs et référentiel minimal. */
export function freshDatabase() {
  closeDb();
  removeDbFiles();
  for (const dir of [config.uploadDir, config.backupDir, config.tmpDir]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const db = getDb();
  runMigrations(db, { logger: { info() {} } });
  ensureTaxonomy(db, config.seedCsv, { logger: { info() {} } });
  ensureDomainGroups(db, config.groupsCsv, { logger: { info() {} } });
  const hash = bcrypt.hashSync(TEST_PASSWORD, 4);
  const insertUser = db.prepare(`INSERT INTO users(username, full_name, password_hash, role, actif, must_change_password)
                                 VALUES (?, ?, ?, ?, 1, 0)`);
  for (const user of Object.values(USERS)) {
    insertUser.run(user.username, user.full_name, hash, user.role);
  }
  const dairaId = Number(db.prepare('INSERT INTO dairas(name_fr, name_ar, actif) VALUES (?, ?, 1)')
    .run('Daïra Test', 'دائرة اختبار').lastInsertRowid);
  const communeId = Number(db.prepare('INSERT INTO communes(daira_id, name_fr, name_ar, actif) VALUES (?, ?, ?, 1)')
    .run(dairaId, 'Commune Test', 'بلدية اختبار').lastInsertRowid);
  const otherDairaId = Number(db.prepare('INSERT INTO dairas(name_fr, name_ar, actif) VALUES (?, ?, 1)')
    .run('Daïra Autre', 'دائرة أخرى').lastInsertRowid);
  const otherCommuneId = Number(db.prepare('INSERT INTO communes(daira_id, name_fr, name_ar, actif) VALUES (?, ?, ?, 1)')
    .run(otherDairaId, 'Commune Autre', 'بلدية أخرى').lastInsertRowid);
  const epicId = Number(db.prepare('INSERT INTO epics(name, sigle, actif) VALUES (?, ?, 1)')
    .run('EPIC Test', 'EPCT').lastInsertRowid);
  const agentId = Number(db.prepare('INSERT INTO agents(full_name, matricule, zone_daira_id, actif) VALUES (?, ?, ?, 1)')
    .run('Agent Test', 'AG001', dairaId).lastInsertRowid);
  const domaine = db.prepare('SELECT id FROM domaines ORDER BY id LIMIT 1').get();
  const otherDomaine = db.prepare('SELECT id FROM domaines WHERE id <> ? ORDER BY id LIMIT 1').get(domaine.id);
  const type = db.prepare('SELECT id FROM types_anomalie WHERE domaine_id = ? ORDER BY id LIMIT 1').get(domaine.id);
  const otherType = db.prepare('SELECT id FROM types_anomalie WHERE domaine_id = ? ORDER BY id LIMIT 1').get(otherDomaine.id);
  db.prepare('INSERT OR IGNORE INTO epic_domaines(epic_id, domaine_id) VALUES (?, ?)').run(epicId, domaine.id);
  return {
    db,
    refs: {
      dairaId, communeId, otherDairaId, otherCommuneId, epicId, agentId,
      domaineId: domaine.id, otherDomaineId: otherDomaine.id,
      typeId: type.id, otherTypeId: otherType.id,
    },
    userIds: {
      admin: db.prepare("SELECT id FROM users WHERE username = 'admin_test'").get().id,
      operateur: db.prepare("SELECT id FROM users WHERE username = 'operateur_test'").get().id,
      lecteur: db.prepare("SELECT id FROM users WHERE username = 'lecteur_test'").get().id,
    },
  };
}

export function app() {
  return createApp();
}

export async function login(application, role = 'admin', password = TEST_PASSWORD) {
  const agent = request.agent(application);
  const username = USERS[role].username;
  const res = await agent.post('/api/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`Connexion ${username} échouée : ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, csrf: res.body.csrf, user: res.body.user };
}

export function write(agent, csrf, method, url, body) {
  const req = agent[method](url).set('X-CSRF-Token', csrf);
  return body === undefined ? req : req.send(body);
}

export function anomalyPayload(refs, overrides = {}) {
  return {
    lien_url: 'https://www.facebook.com/watch/?v=123456',
    date_signalement: '2026-10-01',
    domaine_id: refs.domaineId,
    type_id: refs.typeId,
    daira_id: refs.dairaId,
    commune_id: refs.communeId,
    adresse_texte: 'Rue de test',
    ...overrides,
  };
}

export function cleanup() {
  closeDb();
  fs.rmSync(process.env.ANM_TEST_ROOT, { recursive: true, force: true });
}
