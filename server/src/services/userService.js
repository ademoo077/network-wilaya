import bcrypt from 'bcryptjs';
import { getDb } from '../db/database.js';

function toUser(row) {
  if (!row) return null;
  const { password_hash: _passwordHash, ...user } = row;
  return user;
}

export function getUserById(id) {
  const row = getDb().prepare('SELECT id, username, full_name, role, active, must_change_password, last_login_at, created_at, updated_at FROM users WHERE id = ?').get(id);
  return toUser(row);
}

export function findUserByUsername(username) {
  const row = getDb().prepare('SELECT id, username, full_name, password_hash, role, active, must_change_password, last_login_at, created_at, updated_at FROM users WHERE username = ?').get(username);
  return row ? { ...toUser(row), passwordHash: row.password_hash } : null;
}

export function createUser({ username, fullName, password, role }) {
  const now = new Date().toISOString();
  const info = getDb().prepare('INSERT INTO users (username, full_name, password_hash, role, active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)').run(username, fullName, bcrypt.hashSync(password, 12), role, now, now);
  const user = getUserById(Number(info.lastInsertRowid));
  return user;
}

export function listUsers() {
  const rows = getDb().prepare('SELECT id, username, full_name, role, active, must_change_password, last_login_at, created_at, updated_at FROM users ORDER BY id').all();
  return rows.map(toUser);
}

export function updateUser(id, patch = {}) {
  const user = getUserById(id);
  if (!user) {
    const err = new Error('Utilisateur introuvable');
    err.status = 404;
    throw err;
  }
  const fullName = patch.fullName ?? user.full_name;
  const role = patch.role ?? user.role;
  const active = patch.active ?? user.active;
  const now = new Date().toISOString();
  getDb().prepare('UPDATE users SET full_name = ?, role = ?, active = ?, updated_at = ? WHERE id = ?').run(fullName, role, active, now, id);
  if (patch.password) {
    getDb().prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?').run(bcrypt.hashSync(patch.password, 12), now, id);
  }
  return getUserById(id);
}

export function deleteUser(id) {
  const user = getUserById(id);
  if (!user) {
    const err = new Error('Utilisateur introuvable');
    err.status = 404;
    throw err;
  }
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
  return { ok: true };
}
