import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, it, expect, beforeAll } from 'vitest';
import { freshDatabase } from './helpers.js';
import { config } from '../src/config/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { ensureVeilleLexicon } from '../src/veille/seed.js';
import { encryptSecret, decryptSecret, encryptJson, decryptJson, pseudonymize } from '../src/veille/secrets.js';
import { ensureVeilleJobs, claimNextJob, finishJob } from '../src/veille/scheduler.js';

let db;

beforeAll(() => {
  ({ db } = freshDatabase());
});

describe('Fondations Veille — migration', () => {
  it('applique les migrations 009 à 012 et crée les tables attendues', () => {
    const version = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get().v;
    expect(version).toBe(16);
    for (const table of [
      'veille_sources', 'veille_elements', 'veille_lexique', 'veille_jobs', 'veille_jetons', 'veille_alertes',
      'syntheses_editions', 'syntheses_modeles', 'syntheses_blocs_bibliotheque', 'syntheses_requetes',
      'syntheses_partages', 'syntheses_planifications', 'syntheses_commentaires', 'objectifs', 'data_version', 'comptes_sociaux', 'comptes_sociaux_historique',
    ]) {
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)?.name).toBe(table);
    }
    expect(db.prepare("PRAGMA table_info(anomalies)").all().some((c) => c.name === 'veille_element_id')).toBe(true);
  });

  it('migre une copie 001–008 sans toucher à la base source', async () => {
    const sourcePath = path.join(config.tmpDir, 'veille-copy-source.db');
    const copyPath = path.join(config.tmpDir, 'veille-copy-target.db');
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${sourcePath}${suffix}`, { force: true });
    const source = new Database(sourcePath);
    try {
      source.exec('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT)');
      for (const file of fs.readdirSync('server/src/db/migrations').filter((f) => /^00[1-8]_.*\.sql$/.test(f)).sort()) {
        source.exec(fs.readFileSync(path.join('server/src/db/migrations', file), 'utf8'));
        source.prepare('INSERT INTO schema_migrations(version, name) VALUES (?, ?)').run(Number.parseInt(file, 10), file);
      }
      await source.backup(copyPath);
    } finally {
      source.close();
    }
    const original = fs.readFileSync(sourcePath);
    expect(fs.existsSync(copyPath)).toBe(true);
    const copy = new Database(copyPath);
    try {
      runMigrations(copy, { logger: { info() {} } });
      expect(copy.prepare('SELECT MAX(version) AS v FROM schema_migrations').get().v).toBe(16);
      expect(copy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='veille_elements'").get()?.name).toBe('veille_elements');
      expect(copy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='syntheses_editions'").get()?.name).toBe('syntheses_editions');
      expect(copy.prepare('SELECT COUNT(*) AS n FROM comptes_sociaux').get().n).toBe(0);
      expect(copy.pragma('integrity_check', { simple: true })).toBe('ok');
      expect(copy.pragma('foreign_key_check')).toEqual([]);
    } finally {
      copy.close();
    }
    expect(db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get().v).toBe(16);
    expect(fs.readFileSync(sourcePath)).toEqual(original);
    for (const file of [sourcePath, copyPath]) fs.rmSync(file, { force: true });
  });
});

describe('Fondations Veille — lexique, secrets, planificateur', () => {
  it('charge 270 termes de façon idempotente sans écraser une édition admin', () => {
    const count = db.prepare('SELECT COUNT(*) AS c FROM veille_lexique').get().c;
    expect(count).toBe(270);
    db.prepare("UPDATE veille_lexique SET poids = 4 WHERE terme = 'نفايات'").run();
    const result = ensureVeilleLexicon(db, config.veilleLexiqueCsv, { logger: { info() {} } });
    expect(result.inserted).toBe(0);
    expect(db.prepare("SELECT poids FROM veille_lexique WHERE terme = 'نفايات'").get().poids).toBe(4);
    expect(db.prepare('SELECT COUNT(*) AS c FROM veille_lexique').get().c).toBe(270);
  });

  it('chiffre les secrets en AES-256-GCM et refuse une mauvaise clé', () => {
    const secret = 'EAAG-token-tres-sensible';
    const encrypted = encryptSecret(secret);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted)).toBe(secret);
    const other = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    expect(() => decryptSecret(encrypted, other)).toThrow(/déchiffrer|altérées/i);
    const json = encryptJson({ token: secret, page: 'Page officielle' });
    expect(decryptJson(json)).toEqual({ token: secret, page: 'Page officielle' });
  });

  it('pseudonymise de façon stable et non réversible', () => {
    const first = pseudonymize('Auteur Public');
    expect(first).toBe(pseudonymize('Auteur Public'));
    expect(first).not.toBe(pseudonymize('Autre Auteur'));
    expect(first).not.toContain('Auteur');
  });

  it('verrouille un job et applique un backoff exponentiel', () => {
    db.prepare("INSERT INTO veille_sources(type, nom, actif, frequence_min) VALUES ('rss', 'Flux test', 1, 30)").run();
    const sourceId = db.prepare("SELECT id FROM veille_sources WHERE nom = 'Flux test'").get().id;
    ensureVeilleJobs(db);
    const now = new Date(Date.now() + 1000);
    const first = claimNextJob(db, 'worker-A', now);
    expect(first.source_id).toBe(sourceId);
    expect(claimNextJob(db, 'worker-B', now)).toBeNull();
    const timing = finishJob(db, first, { ok: false, errorCode: 'RATE_LIMIT', errorMessage: 'Limite atteinte' }, now);
    expect(timing.attempts).toBe(1);
    expect(db.prepare('SELECT statut, tentatives, verrou_par FROM veille_jobs WHERE source_id = ?').get(sourceId))
      .toMatchObject({ statut: 'backoff', tentatives: 1, verrou_par: null });
    const second = claimNextJob(db, 'worker-A', new Date(now.getTime() + 31_000));
    expect(second?.source_id).toBe(sourceId);
    const timing2 = finishJob(db, second, { ok: false, errorCode: 'RATE_LIMIT', errorMessage: 'Limite atteinte' }, new Date(now.getTime() + 31_000));
    expect(timing2.attempts).toBe(2);
    expect(new Date(timing2.next).getTime()).toBeGreaterThan(new Date(timing.next).getTime());
    const success = claimNextJob(db, 'worker-A', new Date(now.getTime() + 10 * 60_000));
    finishJob(db, success, { ok: true, collected: 3, newCount: 2 }, new Date(now.getTime() + 10 * 60_000));
    expect(db.prepare('SELECT statut, tentatives FROM veille_jobs WHERE source_id = ?').get(sourceId))
      .toMatchObject({ statut: 'success', tentatives: 0 });
    expect(db.prepare('SELECT COUNT(*) AS c FROM veille_job_runs WHERE source_id = ?').get(sourceId).c).toBe(3);
  });
});
