import { getDb } from '../db/index.js';

export function audit(req, action, { entite = null, entiteId = null, details = null, username = null, userId = null } = {}) {
  const db = getDb();
  const uid = userId ?? req?.user?.id ?? null;
  const uname = username ?? req?.user?.username ?? null;
  const ip = req?.ip || req?.socket?.remoteAddress || null;
  db.prepare(`INSERT INTO audit_log(user_id, username, action, entite, entite_id, details_json, ip)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(uid, uname, action, entite, entiteId === null ? null : String(entiteId), details ? JSON.stringify(details) : null, ip);
}

export function listAudit(db, { action, user, from, to, page = 1, pageSize = 25 }) {
  const where = [];
  const params = [];
  if (action) { where.push('action = ?'); params.push(action); }
  if (user) { where.push('(username LIKE ? OR user_id = ?)'); params.push(`%${user}%`, Number(user) || -1); }
  if (from) { where.push('at >= ?'); params.push(from); }
  if (to) { where.push('at <= ?'); params.push(`${to}T23:59:59.999Z`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_log ${clause}`).get(...params).c;
  const rows = db.prepare(`SELECT * FROM audit_log ${clause} ORDER BY at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);
  return { rows, total };
}
