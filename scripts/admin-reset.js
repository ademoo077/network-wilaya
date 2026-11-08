import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { passwordErrors } from '@anm/shared';
import { getDb, closeDb } from '../server/src/db/index.js';
import { runMigrations } from '../server/src/db/migrate.js';
import { generatePassword } from '../server/src/db/admin.js';
import { hashPassword } from '../server/src/utils/crypto.js';
import { audit } from '../server/src/services/audit.js';
import { destroyUserSessions } from '../server/src/services/sessions.js';

async function main() {
  const db = getDb();
  runMigrations(db, { logger: console });

  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  let username = args[0];
  let supplied = args[1];

  if (!username) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    username = (await rl.question('Identifiant administrateur [admin] : ')).trim() || 'admin';
    rl.close();
  }

  const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  const admins = db.prepare("SELECT id, username FROM users WHERE role = 'admin' ORDER BY id").all();
  const target = existing || (admins.length === 1 ? admins[0] : null);

  const password = supplied || generatePassword();
  const errors = passwordErrors(password, username);
  if (errors.length) {
    console.error(`Mot de passe refusé : ${errors.join(' · ')}`);
    process.exitCode = 1;
    return;
  }
  const hash = await hashPassword(password);

  if (target) {
    db.prepare(`UPDATE users SET password_hash = ?, role = 'admin', actif = 1, must_change_password = 1,
                failed_attempts = 0, locked_until = NULL,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(hash, target.id);
    destroyUserSessions(db, target.id);
    audit({ user: { id: target.id, username: target.username }, ip: 'script' }, 'USER_RESET_PASSWORD', {
      entite: 'users', entiteId: target.id, details: { source: 'admin:reset' },
    });
    console.log(`\nMot de passe réinitialisé pour « ${target.username} ».`);
    console.log(`Nouveau mot de passe : ${password}`);
    console.log('Changement obligatoire à la prochaine connexion.\n');
  } else {
    const res = db.prepare(`INSERT INTO users(username, full_name, password_hash, role, actif, must_change_password)
                            VALUES (?, 'Administrateur', ?, 'admin', 1, 1)`).run(username, hash);
    audit({ user: { id: res.lastInsertRowid, username }, ip: 'script' }, 'USER_CREATE', {
      entite: 'users', entiteId: res.lastInsertRowid, details: { role: 'admin', source: 'admin:reset' },
    });
    console.log(`\nCompte administrateur créé : ${username}`);
    console.log(`Mot de passe : ${password}`);
    console.log('Changement obligatoire à la prochaine connexion.\n');
  }
  closeDb();
}

main().catch((error) => {
  console.error('Réinitialisation impossible :', error.message);
  process.exit(1);
});
