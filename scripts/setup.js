import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

const TEMPLATE = `# Configuration — Plateforme de suivi des anomalies (Wilaya d'Alger)
# Généré par scripts/setup.js — modifiez les valeurs puis relancez le serveur.
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
TZ=Africa/Algiers
DB_PATH=./data/anomalies.db
UPLOAD_DIR=./data/uploads
BACKUP_DIR=./backups
LOG_DIR=./logs
TMP_DIR=./data/tmp
COOKIE_SECURE=false
HTTPS=false
HTTPS_CERT=./data/certs/server-cert.pem
HTTPS_KEY=./data/certs/server-key.pem
SESSION_TTL_HOURS=8
SECRETS_KEY=${randomBytes(32).toString('hex')}
LOG_LEVEL=info
ADMIN_USERNAME=admin
ADMIN_PASSWORD=
`;

function ensureEnv() {
  if (fs.existsSync(envPath)) {
    console.log('.env existant conservé');
    return false;
  }
  fs.writeFileSync(envPath, TEMPLATE, 'utf8');
  console.log('.env créé');
  return true;
}

function ensureDirs() {
  for (const dir of ['data', 'data/uploads', 'data/tmp', 'backups', 'logs']) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }
  console.log('Dossiers data/, backups/ et logs/ prêts');
}

function ensureDependencies() {
  if (fs.existsSync(path.join(root, 'node_modules'))) return;
  console.log('Installation des dépendances (npm install)…');
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install'], {
    cwd: root, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error('npm install a échoué — installez les dépendances manuellement.');
    process.exit(result.status || 1);
  }
}

async function prepareDb() {
  if (process.argv.includes('--no-db')) return;
  const { prepareDatabase } = await import('../server/src/bootstrap.js');
  const result = await prepareDatabase();
  if (result.taxonomy) {
    console.log(`Taxonomie : ${result.taxonomy.domaines} catégories / ${result.taxonomy.types} types`);
  }
  if (result.admin) {
    console.log(`\nCompte administrateur créé : ${result.admin.username} / ${result.admin.password}`);
    console.log('Ce mot de passe ne sera plus affiché — changez-le à la première connexion.\n');
  }
}

ensureEnv();
ensureDirs();
ensureDependencies();
await prepareDb();
console.log(`Prêt. Lancez « npm start » puis ouvrez http://localhost:3000`);
