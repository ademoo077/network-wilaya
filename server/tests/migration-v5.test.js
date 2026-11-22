import { beforeAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config/index.js';
import { ensureDomainGroups, runMigrations } from '../src/db/migrate.js';
import { freshDatabase } from './helpers.js';

let db;

beforeAll(() => { ({ db } = freshDatabase()); });

describe('Migration V5 et groupes thématiques', () => {
  it('applique 002 puis 003 (index) sans altérer les tables V4', () => {
    const versions = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((row) => row.version);
    expect(versions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    const columns = db.prepare("PRAGMA table_info('anomalies')").all().map((row) => row.name);
    expect(columns).toEqual(expect.arrayContaining([
      'gps_source', 'gps_precision_m', 'gps_verifiee', 'lie_a_id', 'contenu_type',
      'date_publication_estimee', 'legende', 'auteur_publication',
    ]));
    for (const table of ['groupes_domaines', 'limites_communes', 'liens_cache', 'vues_sauvegardees', 'boite_reception', 'comptes_sociaux']) {
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)?.name).toBe(table);
    }
    const indexes = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='anomalies'").all();
    expect(indexes.find((row) => row.name === 'idx_anomalies_deleted').sql)
      .toContain('WHERE deleted_at IS NOT NULL');
    expect(indexes.some((row) => row.name === 'idx_anomalies_traitement_actif')).toBe(true);
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(db.pragma('foreign_key_check')).toEqual([]);
  });

  it('préserve une anomalie existante lors du passage réel de 001 à 002', () => {
    const memory = new Database(':memory:');
    memory.pragma('foreign_keys = ON');
    const here = path.dirname(fileURLToPath(import.meta.url));
    memory.exec(fs.readFileSync(path.resolve(here, '../src/db/migrations/001_init.sql'), 'utf8'));
    memory.exec(`CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
      INSERT INTO schema_migrations VALUES (1, '001_init.sql', '2026-01-01T00:00:00.000Z');
      INSERT INTO users(id,username,full_name,password_hash,role) VALUES (1,'avant_v5','Avant V5','x','admin');
      INSERT INTO domaines(id,name_ar,ordre) VALUES (1,'مجال',1);
      INSERT INTO types_anomalie(id,domaine_id,name_ar,ordre) VALUES (1,1,'نوع',1);
      INSERT INTO dairas(id,name_fr) VALUES (1,'Daira');
      INSERT INTO communes(id,daira_id,name_fr) VALUES (1,1,'Commune');
      INSERT INTO anomalies(reference,plateforme,lien_url,lien_normalise,date_signalement,domaine_id,type_id,daira_id,commune_id,priorite,search_norm,saisi_par)
      VALUES ('ANM-2026-00001','facebook','https://facebook.com/a','https://facebook.com/a','2026-01-02',1,1,1,1,'normale','avant v5',1);`);
    runMigrations(memory, { logger: { info() {} } });
    expect(memory.prepare('SELECT reference, search_norm, gps_verifiee FROM anomalies').get())
      .toEqual({ reference: 'ANM-2026-00001', search_norm: 'avant v5', gps_verifiee: 0 });
    expect(memory.pragma('foreign_key_check')).toEqual([]);
    memory.close();
  });

  it('installe les neuf nouveaux paramètres avec leurs valeurs sûres', () => {
    const params = Object.fromEntries(db.prepare('SELECT cle, valeur FROM parametres').all().map((row) => [row.cle, row.valeur]));
    expect(params).toMatchObject({
      rayon_doublon_m: '50', objectif_taux_traitement: '80', sla_urgente_j: '2',
      sla_haute_j: '5', sla_normale_j: '10', delai_verification_cible_j: '2',
      enrichissement_en_ligne: '0', rapport_auto_fige: '1', https_actif: '0',
    });
  });

  it('rattache les 70 catégories à exactement 9 groupes', () => {
    const result = ensureDomainGroups(db, config.groupsCsv, { logger: { info() {} } });
    expect(result.groupes).toBe(9);
    expect(result.rattaches).toBe(70);
    expect(result.nonRattaches).toEqual([]);
  });

  it('reste idempotent sans écraser les modifications administrateur', () => {
    const group = db.prepare('SELECT id FROM groupes_domaines ORDER BY ordre LIMIT 1').get();
    const other = db.prepare('SELECT id FROM groupes_domaines WHERE id <> ? ORDER BY ordre LIMIT 1').get(group.id);
    const domain = db.prepare('SELECT id FROM domaines WHERE groupe_id = ? ORDER BY ordre LIMIT 1').get(group.id);
    db.prepare('UPDATE groupes_domaines SET name_fr = ? WHERE id = ?').run('Libellé personnalisé', group.id);
    db.prepare('UPDATE domaines SET groupe_id = ? WHERE id = ?').run(other.id, domain.id);
    const result = ensureDomainGroups(db, config.groupsCsv, { logger: { info() {} } });
    expect(result.groupes).toBe(9);
    expect(db.prepare('SELECT name_fr FROM groupes_domaines WHERE id = ?').get(group.id).name_fr).toBe('Libellé personnalisé');
    expect(db.prepare('SELECT groupe_id FROM domaines WHERE id = ?').get(domain.id).groupe_id).toBe(other.id);
  });
});
