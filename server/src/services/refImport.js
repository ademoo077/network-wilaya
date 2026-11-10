import { parse } from 'csv-parse/sync';
import { normalize, refSchemas } from '@anm/shared';
import { createRef } from './refs.js';

const COLUMNS = {
  domaines: ['name_ar', 'name_fr', 'ordre'],
  types: ['domaine_ar', 'name_ar', 'name_fr', 'ordre'],
  dairas: ['name_fr', 'name_ar'],
  communes: ['daira_fr', 'name_fr', 'name_ar'],
  epics: ['name', 'sigle', 'contact_nom', 'contact_tel', 'domaines'],
  agents: ['full_name', 'grade', 'email', 'matricule', 'telephone', 'daira'],
};

export function parseCsv(buffer) {
  const text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer || '');
  const clean = text.replace(/^\uFEFF/, '');
  return parse(clean, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
}

function lookup(db, table, column, value) {
  if (!value) return null;
  return db.prepare(`SELECT * FROM ${table} WHERE ${column} = ? COLLATE NOCASE`).get(value)
    || db.prepare(`SELECT * FROM ${table} WHERE ${column} = ?`).get(value);
}

function resolveRow(db, entite, row) {
  if (entite === 'domaines') {
    if (!row.name_ar) throw new Error('name_ar requis');
    return { name_ar: row.name_ar, name_fr: row.name_fr || null, ordre: row.ordre ? Number(row.ordre) : undefined };
  }
  if (entite === 'types') {
    if (!row.name_ar) throw new Error('name_ar requis');
    const domaine = row.domaine_ar
      ? db.prepare('SELECT id FROM domaines WHERE name_ar = ?').get(row.domaine_ar)
      : db.prepare('SELECT id FROM domaines WHERE name_fr = ? COLLATE NOCASE').get(row.domaine_fr);
    if (!domaine) throw new Error(`Catégorie inconnue : ${row.domaine_ar || row.domaine_fr || '—'}`);
    return { domaine_id: domaine.id, name_ar: row.name_ar, name_fr: row.name_fr || null, ordre: row.ordre ? Number(row.ordre) : undefined };
  }
  if (entite === 'dairas') {
    if (!row.name_fr) throw new Error('name_fr requis');
    return { name_fr: row.name_fr, name_ar: row.name_ar || null };
  }
  if (entite === 'communes') {
    if (!row.name_fr) throw new Error('name_fr requis');
    const daira = row.daira_fr
      ? db.prepare('SELECT id FROM dairas WHERE name_fr = ? COLLATE NOCASE').get(row.daira_fr)
      : db.prepare('SELECT id FROM dairas WHERE name_ar = ?').get(row.daira_ar);
    if (!daira) throw new Error(`Daïra inconnue : ${row.daira_fr || row.daira_ar || '—'}`);
    return { daira_id: daira.id, name_fr: row.name_fr, name_ar: row.name_ar || null };
  }
  if (entite === 'epics') {
    if (!row.name) throw new Error('name requis');
    const names = String(row.domaines || '').split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    const domaine_ids = [];
    for (const name of names) {
      const domaine = db.prepare('SELECT id FROM domaines WHERE name_ar = ? OR name_fr = ? COLLATE NOCASE').get(name, name);
      if (!domaine) throw new Error(`Catégorie inconnue : ${name}`);
      domaine_ids.push(domaine.id);
    }
    return { name: row.name, sigle: row.sigle || null, contact_nom: row.contact_nom || null, contact_tel: row.contact_tel || null, domaine_ids };
  }
  if (entite === 'agents') {
    if (!row.full_name) throw new Error('full_name requis');
    const daira = lookup(db, 'dairas', 'name_fr', row.daira);
    return { full_name: row.full_name, grade: row.grade || null, email: row.email || null,
      matricule: row.matricule || null, telephone: row.telephone || null, zone_daira_id: daira?.id || null };
  }
  throw new Error('Entité inconnue');
}

function findExisting(db, entite, data) {
  if (entite === 'domaines') return db.prepare('SELECT id FROM domaines WHERE name_ar = ?').get(data.name_ar);
  if (entite === 'types') return db.prepare('SELECT id FROM types_anomalie WHERE domaine_id = ? AND name_ar = ?').get(data.domaine_id, data.name_ar);
  if (entite === 'dairas') return db.prepare('SELECT id FROM dairas WHERE name_fr = ? COLLATE NOCASE').get(data.name_fr);
  if (entite === 'communes') return db.prepare('SELECT id FROM communes WHERE daira_id = ? AND name_fr = ? COLLATE NOCASE').get(data.daira_id, data.name_fr);
  if (entite === 'epics') return db.prepare('SELECT id FROM epics WHERE name = ? COLLATE NOCASE').get(data.name);
  if (entite === 'agents') {
    if (data.matricule) return db.prepare('SELECT id FROM agents WHERE matricule = ?').get(data.matricule);
    if (data.email) return db.prepare('SELECT id FROM agents WHERE email = ? COLLATE NOCASE').get(data.email);
    return db.prepare('SELECT id FROM agents WHERE full_name = ? AND matricule IS NULL AND email IS NULL').get(data.full_name);
  }
  return null;
}

export function importRefRows(db, entite, rows, { commit = false } = {}) {
  const seen = new Set();
  const preview = rows.map((row, index) => {
    try {
      const data = refSchemas[entite].parse(resolveRow(db, entite, row));
      const identity = JSON.stringify([data.domaine_id, data.daira_id,
        normalize(data.matricule || data.email || data.name || data.name_ar || data.name_fr || data.full_name)]);
      const existing = findExisting(db, entite, data) || seen.has(identity);
      seen.add(identity);
      return { ligne: index + 2, statut: existing ? 'warning' : 'ok', message: existing ? 'Existe déjà — ignorée' : 'Prête', data, existing: Boolean(existing) };
    } catch (error) {
      return { ligne: index + 2, statut: 'error', message: error.message, raw: row };
    }
  });
  const summary = {
    total: preview.length,
    ok: preview.filter((r) => r.statut === 'ok').length,
    warning: preview.filter((r) => r.statut === 'warning').length,
    error: preview.filter((r) => r.statut === 'error').length,
  };
  if (!commit) return { rows: preview, summary, committed: false };
  let created = 0;
  db.transaction(() => {
    for (const row of preview) {
      if (row.statut !== 'ok') continue;
      createRef(db, entite, row.data);
      created += 1;
    }
  })();
  return { rows: preview, summary: { ...summary, created }, committed: true };
}

export function templateColumns(entite) {
  return COLUMNS[entite] || [];
}
