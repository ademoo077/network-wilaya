import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { normalizeTerm } from '@anm/shared';

const LANGUES = new Set(['ar', 'fr', 'dz', 'mix']);
const ROLES = new Set(['theme', 'urgence', 'exclusion']);

export function importVeilleLexicon(db, csvPath, { logger = console } = {}) {
  if (!fs.existsSync(csvPath)) throw new Error(`Lexique Veille introuvable : ${csvPath}`);
  const raw = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  const groups = new Map(db.prepare('SELECT id, name_fr FROM groupes_domaines').all().map((r) => [r.name_fr, r.id]));
  const domains = new Map(db.prepare('SELECT id, name_ar FROM domaines').all().map((r) => [r.name_ar, r.id]));
  const insert = db.prepare(`INSERT OR IGNORE INTO veille_lexique
    (terme, terme_norm, langue, role, groupe_id, domaine_id, poids, origine)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'seed')`);
  let inserted = 0;
  let ignored = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      const langue = String(row.langue || '').trim();
      const role = String(row.role || '').trim();
      const poids = Number(row.poids);
      const terme = String(row.terme || '').trim();
      if (!terme || !LANGUES.has(langue) || !ROLES.has(role) || !Number.isInteger(poids) || poids < -5 || poids > 5) {
        ignored += 1;
        continue;
      }
      const groupeId = row.groupe_fr && row.groupe_fr !== '*' ? groups.get(row.groupe_fr) || null : null;
      const domaineId = row.domaine_ar ? domains.get(row.domaine_ar) || null : null;
      const result = insert.run(terme, normalizeTerm(terme, langue), langue, role, groupeId, domaineId, poids);
      if (result.changes) inserted += 1;
      else ignored += 1;
    }
  });
  tx();
  const total = db.prepare('SELECT COUNT(*) AS c FROM veille_lexique').get().c;
  logger.info?.(`Lexique Veille : ${inserted} ajoutés, ${ignored} inchangés, ${total} termes`);
  return { total, inserted, ignored };
}

export function ensureVeilleLexicon(db, csvPath, options = {}) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM veille_lexique').get().c;
  if (count >= 270) return { total: count, inserted: 0, ignored: count, already: true };
  return importVeilleLexicon(db, csvPath, options);
}
