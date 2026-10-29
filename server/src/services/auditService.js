import { getDb } from '../db/database.js';

export function logAudit({ userId, action, entite, entiteId, details, ip }) {
  const info = getDb().prepare('INSERT INTO audit_log (user_id, action, entite, entite_id, details_json, ip, at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId || null, action, entite || null, entiteId == null ? null : String(entiteId), details ? JSON.stringify(details) : null, ip || null, new Date().toISOString());
  return Number(info.lastInsertRowid);
}

export function listAudit({ page = 1, pageSize = 50, userId } = {}) {
  const conditions = [];
  const params = [];
  if (userId) {
    conditions.push('user_id = ?');
    params.push(userId);
  }
  const whereSql = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const countRow = getDb().prepare(`SELECT COUNT(*) AS c FROM audit_log${whereSql}`).all(...params);
  const rows = getDb().prepare(`SELECT id, user_id, action, entite, entite_id, details_json, ip, at FROM audit_log${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize);
  const data = rows.map((row) => ({ ...row, details: row.details_json ? JSON.parse(row.details_json) : null }));
  return {
    data,
    pagination: {
      page,
      pageSize,
      total: Number(countRow[0].c),
      totalPages: Math.max(1, Math.ceil(Number(countRow[0].c) / pageSize)),
    },
  };
}
