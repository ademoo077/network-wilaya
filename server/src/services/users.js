import { hashPassword } from '../utils/crypto.js';
import { generatePassword } from '../db/admin.js';
import { conflict, notFound, badRequest } from '../utils/errors.js';
import { passwordErrors } from '@anm/shared';

export function listUsers(db) {
  return db.prepare(`SELECT id, username, full_name, role, actif, must_change_password,
                            failed_attempts, locked_until, last_login_at, created_at
                     FROM users ORDER BY role, username COLLATE NOCASE`).all();
}

function activeAdminCount(db, exceptId = null) {
  return db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND actif = 1 AND id <> ?").get(exceptId ?? -1).c;
}

export async function createUser(db, data) {
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(data.username);
  if (exists) throw conflict('IDENTIFIANT_EXISTE', 'Cet identifiant existe déjà');
  const errors = passwordErrors(data.password, data.username);
  if (errors.length) throw badRequest('Mot de passe trop faible', { password: errors.join(' · ') });
  const hash = await hashPassword(data.password);
  const res = db.prepare(`INSERT INTO users(username, full_name, password_hash, role, actif, must_change_password)
                          VALUES (?, ?, ?, ?, 1, 1)`)
    .run(data.username, data.full_name, hash, data.role);
  return db.prepare('SELECT id, username, full_name, role, actif, must_change_password FROM users WHERE id = ?').get(res.lastInsertRowid);
}

export function updateUser(db, id, data, currentUserId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) throw notFound('Utilisateur introuvable');
  const nextRole = data.role ?? user.role;
  const nextActif = data.actif ?? user.actif;
  if (user.role === 'admin' && user.actif === 1 && (nextRole !== 'admin' || !nextActif) && activeAdminCount(db, id) === 0) {
    throw conflict('DERNIER_ADMIN', 'Impossible de désactiver ou rétrograder le dernier administrateur actif');
  }
  if (id === currentUserId && nextActif === 0) {
    throw conflict('AUTO_DESACTIVATION', 'Vous ne pouvez pas désactiver votre propre compte');
  }
  db.prepare(`UPDATE users SET full_name = ?, role = ?, actif = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(data.full_name ?? user.full_name, nextRole, nextActif ? 1 : 0, id);
  return db.prepare('SELECT id, username, full_name, role, actif FROM users WHERE id = ?').get(id);
}

export async function resetUserPassword(db, id, providedPassword = null) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) throw notFound('Utilisateur introuvable');
  let password = providedPassword;
  if (password) {
    const errors = passwordErrors(password, user.username);
    if (errors.length) throw badRequest('Mot de passe trop faible', { password: errors.join(' · ') });
  } else {
    password = generatePassword();
  }
  const hash = await hashPassword(password);
  db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 1, failed_attempts = 0,
              locked_until = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(hash, id);
  return { password, must_change_password: 1 };
}
