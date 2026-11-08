import crypto from 'node:crypto';
import { hashPassword } from '../utils/crypto.js';
import { passwordErrors } from '@anm/shared';

export function generatePassword() {
  const token = crypto.randomBytes(9).toString('base64url').replace(/[-_]/g, 'x');
  return `${token}7a`;
}

export async function ensureAdmin(db, config, logger = console) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return null;
  let password = config.adminPassword;
  let source = 'ADMIN_PASSWORD';
  if (!password || passwordErrors(password, config.adminUsername).length) {
    password = generatePassword();
    source = 'généré';
  }
  const hash = await hashPassword(password);
  const result = db.prepare(`INSERT INTO users(username, full_name, password_hash, role, actif, must_change_password)
                             VALUES (?, ?, ?, 'admin', 1, 1)`)
    .run(config.adminUsername, 'Administrateur', hash);
  const message = `Compte administrateur initial créé : ${config.adminUsername} / ${password} (${source}) — changement obligatoire à la première connexion`;
  logger.info?.(message);
  return { id: result.lastInsertRowid, username: config.adminUsername, password, source };
}
