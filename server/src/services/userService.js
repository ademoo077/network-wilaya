import bcrypt from 'bcryptjs';
import db from '../db/database.js';

function toUser(row) {
  if (!row) return null;
  const { password_hash, ...user } = row;
  return user;
}

export function getUserById(id) {
  const row = db.prepare('SELECT id, username, full_name, role, active, must_change_password, last_login_at, created_at, updated_at FROM users WHERE id = ?').get(id);
  return toUser(row);
}

export function findUserByUsername(username) {
  const row = db.prepare('SELECT id, username, full_name, password_hash, role, active, must_change_password, last_login_at, created_at, updated_at FROM users WHERE username = ?').get(username);
  return row ? { ...toUser(row), passwordHash: row.password_hash } : null;
}

export function createUser({ username, fullName, password, role }) {
  const now = new Date().toISOString();
  const info = db.prepare('INSERT INTO users (username, full_name, password_hash, role, active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)').run(username, fullName, bcrypt.hashSync(password, 12), role, now, now);
  const user = getUserById(Number(info.lastInsertRowid));
  return user;
}

export function listUsers() {
  const rows = db.prepare('SELECT id, username, full_name, role, active, must_change_password, last_login_at, created_at, updated_at FROM users ORDER BY id').all();
  return rows.map(toUser);
}
