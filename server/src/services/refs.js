import { normalize } from '@anm/shared';
import { getParams, publicParams } from './settings.js';
import { recalcSearchNorm } from './searchNorm.js';
import { AppError, conflict, notFound, business } from '../utils/errors.js';
import { withWorkflow } from './interventions.js';

const SELECTS = {
  domaines: 'SELECT * FROM domaines ORDER BY ordre, id',
  types: 'SELECT * FROM types_anomalie ORDER BY domaine_id, ordre, id',
  dairas: 'SELECT * FROM dairas ORDER BY name_fr COLLATE NOCASE',
  communes: 'SELECT * FROM communes ORDER BY name_fr COLLATE NOCASE',
  epics: 'SELECT * FROM epics ORDER BY name COLLATE NOCASE',
  agents: 'SELECT * FROM agents ORDER BY full_name COLLATE NOCASE',
};

export function bootstrap(db) {
  const domaines = db.prepare(SELECTS.domaines).all();
  const types = db.prepare(SELECTS.types).all();
  const dairas = db.prepare(SELECTS.dairas).all();
  const communes = db.prepare(SELECTS.communes).all();
  const epics = db.prepare(SELECTS.epics).all();
  const agents = db.prepare(SELECTS.agents).all();
  const epicDomaines = db.prepare('SELECT epic_id, domaine_id FROM epic_domaines').all();
  const byEpic = new Map();
  for (const row of epicDomaines) {
    if (!byEpic.has(row.epic_id)) byEpic.set(row.epic_id, []);
    byEpic.get(row.epic_id).push(row.domaine_id);
  }
  const typesByDomain = new Map();
  for (const type of types) {
    if (!typesByDomain.has(type.domaine_id)) typesByDomain.set(type.domaine_id, []);
    typesByDomain.get(type.domaine_id).push(type);
  }
  const communesByDaira = new Map();
  for (const commune of communes) {
    if (!communesByDaira.has(commune.daira_id)) communesByDaira.set(commune.daira_id, []);
    communesByDaira.get(commune.daira_id).push(commune);
  }
  return {
    domaines: domaines.map((d) => ({ ...d, types: typesByDomain.get(d.id) || [] })),
    dairas: dairas.map((d) => ({ ...d, communes: communesByDaira.get(d.id) || [] })),
    epics: epics.map((e) => ({ ...withWorkflow(e), domaine_ids: byEpic.get(e.id) || [] })),
    agents,
    parametres: publicParams(db),
    taxonomie: {
      domaines: domaines.length,
      types: types.length,
      ok: domaines.length === 70 && types.length === 156,
    },
  };
}

export function setupStatus(db) {
  const count = (sql) => db.prepare(sql).get().c;
  const domaines = count('SELECT COUNT(*) AS c FROM domaines');
  const types = count('SELECT COUNT(*) AS c FROM types_anomalie');
  const dairas = count('SELECT COUNT(*) AS c FROM dairas');
  const epics = count('SELECT COUNT(*) AS c FROM epics');
  const agents = count('SELECT COUNT(*) AS c FROM agents');
  const users = count('SELECT COUNT(*) AS c FROM users');
  return {
    referentielTerritorialVide: dairas === 0,
    epicsVides: epics === 0,
    agentsVides: agents === 0,
    taxonomieOk: domaines === 70 && types === 156,
    taxonomie: { domaines, types },
    premierDemarrage: users === 0 || dairas === 0,
  };
}

function rethrowConstraint(error, label) {
  if (String(error.message).includes('UNIQUE')) {
    throw conflict('DOUBLON_REFERENTIEL', `Ce ${label} existe déjà`, null);
  }
  if (String(error.message).includes('FOREIGN KEY')) {
    throw business('Référence parente introuvable');
  }
  throw error;
}

function nextOrdre(db, table, where = '', params = []) {
  const row = db.prepare(`SELECT COALESCE(MAX(ordre), 0) + 1 AS n FROM ${table} ${where}`).get(...params);
  return row.n;
}

export function createRef(db, entite, data) {
  try {
    if (entite === 'domaines') {
      const ordre = data.ordre ?? nextOrdre(db, 'domaines');
      const res = db.prepare('INSERT INTO domaines(name_ar, name_fr, ordre, actif) VALUES (?, ?, ?, ?)')
        .run(data.name_ar, data.name_fr || null, ordre, data.actif ?? 1);
      return { id: res.lastInsertRowid };
    }
    if (entite === 'types') {
      const ordre = data.ordre ?? nextOrdre(db, 'types_anomalie', 'WHERE domaine_id = ?', [data.domaine_id]);
      const res = db.prepare('INSERT INTO types_anomalie(domaine_id, name_ar, name_fr, ordre, actif) VALUES (?, ?, ?, ?, ?)')
        .run(data.domaine_id, data.name_ar, data.name_fr || null, ordre, data.actif ?? 1);
      return { id: res.lastInsertRowid };
    }
    if (entite === 'dairas') {
      const res = db.prepare('INSERT INTO dairas(name_fr, name_ar, actif) VALUES (?, ?, ?)')
        .run(data.name_fr, data.name_ar || null, data.actif ?? 1);
      return { id: res.lastInsertRowid };
    }
    if (entite === 'communes') {
      const daira = db.prepare('SELECT id FROM dairas WHERE id = ?').get(data.daira_id);
      if (!daira) throw business('Daïra introuvable');
      const res = db.prepare('INSERT INTO communes(daira_id, name_fr, name_ar, actif) VALUES (?, ?, ?, ?)')
        .run(data.daira_id, data.name_fr, data.name_ar || null, data.actif ?? 1);
      return { id: res.lastInsertRowid };
    }
    if (entite === 'epics') {
      return db.transaction(() => {
        const res = db.prepare('INSERT INTO epics(name, sigle, contact_nom, contact_tel, actif, workflow_json) VALUES (?, ?, ?, ?, ?, ?)')
          .run(data.name, data.sigle || null, data.contact_nom || null, data.contact_tel || null, data.actif ?? 1, data.workflow ? JSON.stringify(data.workflow) : null);
        const id = res.lastInsertRowid;
        const stmt = db.prepare('INSERT OR IGNORE INTO epic_domaines(epic_id, domaine_id) VALUES (?, ?)');
        for (const domaineId of data.domaine_ids || []) stmt.run(id, domaineId);
        return { id };
      })();
    }
    if (entite === 'agents') {
      const res = db.prepare('INSERT INTO agents(full_name, matricule, telephone, zone_daira_id, actif, grade, email) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(data.full_name, data.matricule || null, data.telephone || null, data.zone_daira_id || null, data.actif ?? 1, data.grade || null, data.email || null);
      return { id: res.lastInsertRowid };
    }
    throw notFound('Entité inconnue');
  } catch (error) {
    if (error instanceof AppError) throw error;
    rethrowConstraint(error, entite.slice(0, -1));
  }
}

export function updateRef(db, entite, id, data) {
  const table = entite === 'types' ? 'types_anomalie' : entite;
  const current = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!current) throw notFound('Référentiel introuvable');
  try {
    return db.transaction(() => {
      if (entite === 'epics' && data.workflow !== undefined) db.prepare('UPDATE epics SET workflow_json=? WHERE id=?').run(data.workflow ? JSON.stringify(data.workflow) : null, id);
      if (entite === 'epics' && Array.isArray(data.domaine_ids)) {
        db.prepare('DELETE FROM epic_domaines WHERE epic_id = ?').run(id);
        const stmt = db.prepare('INSERT OR IGNORE INTO epic_domaines(epic_id, domaine_id) VALUES (?, ?)');
        for (const domaineId of data.domaine_ids) stmt.run(id, domaineId);
      }
      if (entite === 'types' && data.domaine_id && data.domaine_id !== current.domaine_id) {
        const used = db.prepare('SELECT COUNT(*) AS c FROM anomalies WHERE type_id = ?').get(id).c;
        if (used) throw conflict('TYPE_UTILISE', 'Ce type est utilisé : déplacez d’abord les anomalies concernées');
      }
      const fields = [];
      const params = [];
      const allowed = {
        domaines: ['name_ar', 'name_fr', 'ordre', 'actif'],
        types: ['domaine_id', 'name_ar', 'name_fr', 'ordre', 'actif'],
        dairas: ['name_fr', 'name_ar', 'actif'],
        communes: ['daira_id', 'name_fr', 'name_ar', 'actif'],
        epics: ['name', 'sigle', 'contact_nom', 'contact_tel', 'actif'],
        agents: ['full_name', 'matricule', 'telephone', 'zone_daira_id', 'actif', 'grade', 'email'],
      }[entite];
      for (const key of allowed) {
        if (data[key] !== undefined) { fields.push(`${key} = ?`); params.push(data[key]); }
      }
      if (fields.length) {
        fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
        db.prepare(`UPDATE ${table} SET ${fields.join(', ')} WHERE id = ?`).run(...params, id);
      }
      recalcForRef(db, entite, id, current, data);
      return { id };
    })();
  } catch (error) {
    if (error instanceof AppError) throw error;
    rethrowConstraint(error, entite.slice(0, -1));
  }
}

function recalcForRef(db, entite, id, current, data) {
  const nameKeys = ['name_ar', 'name_fr', 'name', 'full_name'];
  const renamed = nameKeys.some((key) => data[key] !== undefined && data[key] !== current[key]);
  if (!renamed) return;
  if (entite === 'domaines') recalcSearchNorm(db, 'a.domaine_id = ? OR t.domaine_id = ?', [id, id]);
  else if (entite === 'types') recalcSearchNorm(db, 'a.type_id = ?', [id]);
  else if (entite === 'dairas') recalcSearchNorm(db, 'a.daira_id = ? OR c.daira_id = ?', [id, id]);
  else if (entite === 'communes') recalcSearchNorm(db, 'a.commune_id = ?', [id]);
  else if (entite === 'epics') recalcSearchNorm(db, 'a.epic_id = ?', [id]);
  else if (entite === 'agents') recalcSearchNorm(db, 'a.agent_id = ?', [id]);
}

/** Désactivation (jamais de suppression physique). */
export function disableRef(db, entite, id) {
  return updateRef(db, entite, id, { actif: 0 });
}

function splitCommunes(value) {
  return String(value || '')
    .split(/[,،;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitDairaCommunes(line) {
  if (line.includes(';')) {
    const parts = line.split(';').map((part) => part.trim()).filter(Boolean);
    return { dairaName: parts[0] || '', communes: parts.slice(1) };
  }
  if (line.includes(':')) {
    const idx = line.indexOf(':');
    return { dairaName: line.slice(0, idx).trim(), communes: splitCommunes(line.slice(idx + 1)) };
  }
  if (line.includes('\t')) {
    const parts = line.split('\t').map((part) => part.trim()).filter(Boolean);
    return { dairaName: parts[0] || '', communes: splitCommunes(parts.slice(1).join(',')) };
  }
  if (line.includes('|')) {
    const parts = line.split('|').map((part) => part.trim()).filter(Boolean);
    return { dairaName: parts[0] || '', communes: splitCommunes(parts.slice(1).join(',')) };
  }
  const dash = line.match(/\s[-–—]\s/);
  if (dash && dash.index > 0) {
    return {
      dairaName: line.slice(0, dash.index).trim(),
      communes: splitCommunes(line.slice(dash.index + dash[0].length)),
    };
  }
  return null;
}

export function parseTerritoire(text) {
  const dairas = new Map();
  const doublons = [];
  const invalides = [];
  const seen = new Set();
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const parsed = splitDairaCommunes(line);
    if (!parsed) {
      invalides.push({
        ligne: index + 1,
        texte: line,
        motif: 'Format attendu : « Daïra ; Commune » ou « Daïra : commune1, commune2 » (séparateurs acceptés : ; : | tab , - )',
      });
      return;
    }
    const dairaName = parsed.dairaName;
    const communes = parsed.communes;
    if (!dairaName || !communes.length) {
      invalides.push({ ligne: index + 1, texte: line, motif: 'Daïra ou commune manquante' });
      return;
    }
    const key = normalize(dairaName);
    if (!dairas.has(key)) dairas.set(key, { name_fr: dairaName, communes: [] });
    const entry = dairas.get(key);
    for (const commune of communes) {
      const ckey = `${key}|${normalize(commune)}`;
      if (seen.has(ckey)) { doublons.push({ daira: dairaName, commune }); continue; }
      seen.add(ckey);
      entry.communes.push(commune);
    }
  });
  const list = [...dairas.values()];
  return {
    dairas: list,
    totals: { dairas: list.length, communes: list.reduce((n, d) => n + d.communes.length, 0) },
    doublons,
    invalides,
  };
}

export function bulkTerritoire(db, texte, dryRun = false) {
  const parsed = parseTerritoire(texte);
  if (!parsed.dairas.length) throw business('Aucune daïra/commune valide détectée');
  if (dryRun) return { ...parsed, applied: false };
  const result = db.transaction(() => {
    let createdDairas = 0;
    let createdCommunes = 0;
    for (const daira of parsed.dairas) {
      const existing = db.prepare('SELECT id FROM dairas WHERE name_fr = ? COLLATE NOCASE').get(daira.name_fr);
      let id;
      if (existing) {
        db.prepare('UPDATE dairas SET actif = 1 WHERE id = ?').run(existing.id);
        id = existing.id;
      } else {
        id = db.prepare('INSERT INTO dairas(name_fr, actif) VALUES (?, 1)').run(daira.name_fr).lastInsertRowid;
        createdDairas += 1;
      }
      for (const commune of daira.communes) {
        const found = db.prepare('SELECT id FROM communes WHERE daira_id = ? AND name_fr = ? COLLATE NOCASE').get(id, commune);
        if (found) db.prepare('UPDATE communes SET actif = 1 WHERE id = ?').run(found.id);
        else {
          db.prepare('INSERT INTO communes(daira_id, name_fr, actif) VALUES (?, ?, 1)').run(id, commune);
          createdCommunes += 1;
        }
      }
    }
    return { createdDairas, createdCommunes };
  })();
  return { ...parsed, applied: true, ...result };
}

export function findRef(db, entite, id) {
  const table = entite === 'types' ? 'types_anomalie' : entite;
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  return entite === 'epics' ? withWorkflow(row) : row;
}

export function listRef(db, entite) {
  const rows = db.prepare(SELECTS[entite]).all();
  return entite === 'epics' ? rows.map(withWorkflow) : rows;
}

export function allParams(db) {
  return getParams(db);
}
