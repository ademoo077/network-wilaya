import { freshDatabase } from './helpers.js';

let seq = 0;

function inserter(db, refs, userId) {
  return (overrides = {}) => {
    seq += 1;
    const row = {
      reference: `ANM-D${String(seq).padStart(4, '0')}`,
      plateforme: 'facebook',
      lien_url: `https://example.com/d/${seq}`,
      lien_normalise: `https://example.com/d/${seq}`,
      date_signalement: '2026-01-01',
      domaine_id: refs.domaineId,
      type_id: refs.typeId,
      daira_id: refs.dairaId,
      commune_id: refs.communeId,
      priorite: 'normale',
      verification: 'a_verifier',
      statut: 'non_traite',
      saisi_par: userId,
      ...overrides,
    };
    for (const key of Object.keys(row)) if (row[key] === undefined) delete row[key];
    const columns = Object.keys(row);
    const sql = `INSERT INTO anomalies(${columns.join(', ')}) VALUES (${columns.map((c) => `@${c}`).join(', ')})`;
    return Number(db.prepare(sql).run(row).lastInsertRowid);
  };
}

export function setup() {
  const { db, refs, userIds } = freshDatabase();
  return { db, refs, insert: inserter(db, refs, userIds.admin) };
}
