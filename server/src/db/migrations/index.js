import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runMigrations() {
  const migrationsDir = __dirname;
  const files = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
    : [];
  db.prepare('CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL)').run();
  const appliedRows = db.prepare('SELECT name FROM migrations').all();
  const applied = new Set(appliedRows.map((r) => r.name));
  for (const file of files) {
    if (applied.has(file)) continue;
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec(content);
    db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(file, new Date().toISOString());
  }
}
