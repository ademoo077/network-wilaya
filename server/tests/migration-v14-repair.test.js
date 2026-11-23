import { beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../src/db/migrate.js';
import { freshDatabase } from './helpers.js';

let db;
const colonnePresente = () => db.prepare('PRAGMA table_info(anomalies)').all().some((row) => row.name === 'sans_photo_motif');

beforeAll(() => { ({ db } = freshDatabase()); });

describe('Migration 016 — réparation sans_photo_motif', () => {
  it('ajoute la colonne manquante d\'une base où 013 avait été enregistrée sans elle', () => {
    expect(db.prepare('SELECT MAX(version) v FROM schema_migrations').get().v).toBe(18);
    db.exec('ALTER TABLE anomalies DROP COLUMN sans_photo_motif');
    db.prepare('DELETE FROM schema_migrations WHERE version=16').run();
    expect(colonnePresente()).toBe(false);

    runMigrations(db, { logger: { info() {} } });

    expect(colonnePresente()).toBe(true);
    expect(db.prepare('SELECT MAX(version) v FROM schema_migrations').get().v).toBe(18);
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(db.pragma('foreign_key_check')).toEqual([]);
  });

  it('reste idempotente et conserve les données existantes', () => {
    const avant = db.prepare('SELECT COUNT(*) n FROM anomalies').get().n;
    runMigrations(db, { logger: { info() {} } });
    expect(db.prepare('SELECT COUNT(*) n FROM anomalies').get().n).toBe(avant);
    expect(db.prepare('SELECT COUNT(*) n FROM schema_migrations WHERE version=16').get().n).toBe(1);
    expect(colonnePresente()).toBe(true);
  });
});
