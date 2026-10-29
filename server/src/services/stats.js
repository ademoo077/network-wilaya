import db from '../db/database.js';

function buildConditions(filters = {}) {
  const conditions = [];
  const params = [];
  if (filters.from) { conditions.push('date_signalement >= ?'); params.push(filters.from); }
  if (filters.to) { conditions.push('date_signalement <= ?'); params.push(filters.to); }
  if (filters.statut) { conditions.push('statut = ?'); params.push(filters.statut); }
  if (filters.domaineId) { conditions.push('domaine_id = ?'); params.push(filters.domaineId); }
  if (filters.typeId) { conditions.push('type_id = ?'); params.push(filters.typeId); }
  if (filters.dairaId) { conditions.push('daira_id = ?'); params.push(filters.dairaId); }
  if (filters.communeId) { conditions.push('commune_id = ?'); params.push(filters.communeId); }
  if (filters.epicId) { conditions.push('epic_id = ?'); params.push(filters.epicId); }
  if (filters.agentId) { conditions.push('agent_id = ?'); params.push(filters.agentId); }
  if (filters.plateforme) { conditions.push('plateforme = ?'); params.push(filters.plateforme); }
  if (filters.q) { conditions.push('(adresse_texte LIKE ? OR lieu_dit LIKE ? OR lien_url LIKE ? OR observations LIKE ?)'); params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`); }
  const whereSql = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  return { whereSql, params, conditions };
}

function round1(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Math.round(Number(value) * 10) / 10;
}

function pctWithLargestRemainder(totals) {
  const total = Number(totals.non_traite) + Number(totals.en_cours) + Number(totals.traite);
  const result = { non_traite: null, en_cours: null, traite: null };
  if (total <= 0) return result;
  const raw = {
    non_traite: (Number(totals.non_traite) / total) * 100,
    en_cours: (Number(totals.en_cours) / total) * 100,
    traite: (Number(totals.traite) / total) * 100,
  };
  const rounded = { non_traite: round1(raw.non_traite), en_cours: round1(raw.en_cours), traite: round1(raw.traite) };
  const sum = rounded.non_traite + rounded.en_cours + rounded.traite;
  if (sum !== 100) {
    const order = Object.keys(rounded).sort((a, b) => raw[b] - raw[a]);
    rounded[order[0]] = round1(rounded[order[0]] + (100 - sum));
  }
  return rounded;
}

export function getSummary(filters = {}) {
  const { whereSql, params, conditions } = buildConditions(filters);
  const totalRow = db.prepare(`SELECT COUNT(*) AS c FROM anomalies${whereSql}`).all(...params);
  const total = Number(totalRow[0].c);
  const parStatut = db.prepare(`SELECT statut, COUNT(*) AS c FROM anomalies${whereSql} GROUP BY statut`).all(...params);
  const totals = { non_traite: 0, en_cours: 0, traite: 0 };
  for (const row of parStatut) totals[row.statut] = Number(row.c);
  const tauxTraitement = total > 0 ? round1((Number(totals.traite) / total) * 100) : null;
  const delaiConditions = [...conditions, "statut = 'traite'"];
  const delaiWhere = delaiConditions.length ? ` WHERE ${delaiConditions.join(' AND ')}` : '';
  const delaiRow = db.prepare(`SELECT AVG(julianday(date_traitement) - julianday(date_signalement)) AS d FROM anomalies${delaiWhere}`).all(...params);
  const delaiMoyenJours = delaiRow[0].d === null ? null : Number(delaiRow[0].d);
  const urgentsConditions = [...conditions, "statut != 'traite'", "priorite = 'urgente'", 'deleted_at IS NULL'];
  const urgentsWhere = urgentsConditions.length ? ` WHERE ${urgentsConditions.join(' AND ')}` : '';
  const urgentsRow = db.prepare(`SELECT COUNT(*) AS c FROM anomalies${urgentsWhere}`).all(...params);
  const urgentsCount = Number(urgentsRow[0].c);
  const enRetardConditions = [...conditions, "statut != 'traite'", "date_signalement < date('now', '-7 days')", 'deleted_at IS NULL'];
  const enRetardWhere = enRetardConditions.length ? ` WHERE ${enRetardConditions.join(' AND ')}` : '';
  const enRetardRow = db.prepare(`SELECT COUNT(*) AS c FROM anomalies${enRetardWhere}`).all(...params);
  const enRetardCount = Number(enRetardRow[0].c);
  return {
    total,
    parStatut: totals,
    tauxTraitement,
    delaiMoyenJours: delaiMoyenJours === null ? null : round1(delaiMoyenJours),
    urgents: urgentsCount,
    enRetard: enRetardCount,
    pourcentages: pctWithLargestRemainder(totals),
  };
}

export function getByCategory(filters = {}) {
  const { whereSql, params } = buildConditions(filters);
  const rows = db.prepare(`SELECT d.id AS domaine_id, d.name_ar AS domaine_name, a.statut, COUNT(*) AS c FROM anomalies a JOIN domaines d ON d.id = a.domaine_id${whereSql} GROUP BY d.id, a.statut ORDER BY d.ordre`).all(...params);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.domaine_id)) map.set(row.domaine_id, { domaine_id: row.domaine_id, domaine_name: row.domaine_name, counts: { non_traite: 0, en_cours: 0, traite: 0 } });
    map.get(row.domaine_id).counts[row.statut] = Number(row.c);
  }
  return Array.from(map.values());
}

export function getByType(filters = {}) {
  const { whereSql, params } = buildConditions(filters);
  const rows = db.prepare(`SELECT t.id AS type_id, t.name_ar AS type_name, t.domaine_id AS domaine_id, a.statut, COUNT(*) AS c FROM anomalies a JOIN types_anomalie t ON t.id = a.type_id${whereSql} GROUP BY t.id, a.statut ORDER BY t.domaine_id, t.ordre`).all(...params);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.type_id)) map.set(row.type_id, { type_id: row.type_id, type_name: row.type_name, domaine_id: row.domaine_id, counts: { non_traite: 0, en_cours: 0, traite: 0 } });
    map.get(row.type_id).counts[row.statut] = Number(row.c);
  }
  return Array.from(map.values());
}

export function getByDaira(filters = {}) {
  const { whereSql, params } = buildConditions(filters);
  const rows = db.prepare(`SELECT a.daira_id AS daire_id, d.name_fr AS daire_name, a.statut, COUNT(*) AS c FROM anomalies a JOIN dairas d ON d.id = a.daira_id${whereSql} GROUP BY a.daira_id, a.statut ORDER BY a.daira_id`).all(...params);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.daire_id)) map.set(row.daire_id, { daire_id: row.daire_id, daire_name: row.daire_name, counts: { non_traite: 0, en_cours: 0, traite: 0 } });
    map.get(row.daire_id).counts[row.statut] = Number(row.c);
  }
  return Array.from(map.values());
}

export function getByCommune(filters = {}) {
  const { whereSql, params } = buildConditions(filters);
  const rows = db.prepare(`SELECT a.commune_id AS commune_id, d.name_fr AS commune_name, a.statut, COUNT(*) AS c FROM anomalies a JOIN communes c ON c.id = a.commune_id JOIN dairas d ON d.id = c.daira_id${whereSql} GROUP BY a.commune_id, a.statut ORDER BY a.commune_id`).all(...params);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.commune_id)) map.set(row.commune_id, { commune_id: row.commune_id, commune_name: row.commune_name, counts: { non_traite: 0, en_cours: 0, traite: 0 } });
    map.get(row.commune_id).counts[row.statut] = Number(row.c);
  }
  return Array.from(map.values());
}

export function getByEpic(filters = {}) {
  const { whereSql, params } = buildConditions(filters);
  const rows = db.prepare(`SELECT a.epic_id AS epic_id, e.name AS epic_name, a.statut, COUNT(*) AS c FROM anomalies a JOIN epics e ON e.id = a.epic_id${whereSql} GROUP BY a.epic_id, a.statut ORDER BY a.epic_id`).all(...params);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.epic_id)) map.set(row.epic_id, { epic_id: row.epic_id, epic_name: row.epic_name, counts: { non_traite: 0, en_cours: 0, traite: 0 } });
    map.get(row.epic_id).counts[row.statut] = Number(row.c);
  }
  return Array.from(map.values());
}

export function getByPlatform(filters = {}) {
  const { whereSql, params } = buildConditions(filters);
  const rows = db.prepare(`SELECT plateforme, COUNT(*) AS c FROM anomalies${whereSql} GROUP BY plateforme ORDER BY c DESC`).all(...params);
  return rows.map((r) => ({ plateforme: r.plateforme, count: Number(r.c) }));
}

export function getTimeline({ from, to, granularity = 'day' }) {
  const groupBy = granularity === 'week' ? "strftime('%Y-%m-%d', date_signalement, 'weekday 0', '-6 days')" : granularity === 'month' ? "strftime('%Y-%m', date_signalement)" : 'date_signalement';
  const rows = db.prepare(`SELECT ${groupBy} AS period, COUNT(*) AS c FROM anomalies WHERE date_signalement >= ? AND date_signalement <= ? AND deleted_at IS NULL GROUP BY ${groupBy} ORDER BY ${groupBy}`).all(from, to);
  return rows.map((r) => ({ period: r.period, count: Number(r.c) }));
}

export function getWeekly({ weeks = 12 } = {}) {
  const result = [];
  const now = new Date();
  const day = now.getUTCDay();
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((day + 6) % 7)));
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(weekStart.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = new Date(end.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const receivedRow = db.prepare('SELECT COUNT(*) AS c FROM anomalies WHERE date_signalement >= ? AND date_signalement <= ? AND deleted_at IS NULL').get(startStr, endStr);
    const treatedRow = db.prepare('SELECT COUNT(*) AS c FROM anomalies WHERE date_traitement >= ? AND date_traitement <= ? AND deleted_at IS NULL').get(startStr, endStr);
    result.push({ weekStart: startStr, weekEnd: endStr, received: Number(receivedRow.c), treated: Number(treatedRow.c) });
  }
  return result;
}
