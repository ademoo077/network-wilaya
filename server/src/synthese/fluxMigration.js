/** V15 — conversion idempotente des définitions x/y vers le modèle de flux. */

import { convertirEnFlux } from '@anm/shared';

/**
 * Les snapshots figés ne sont jamais lus : seule la définition courante d'un
 * modèle personnel peut être convertie. Les modèles système sont réécrits par
 * `ensureSystemModels()` et n'ont donc pas besoin d'être migrés ici.
 */
export function convertirDefinitionsEnFlux(db, { logger } = {}) {
  const lignes = db.prepare('SELECT id, definition_json FROM syntheses_modeles WHERE cle_systeme IS NULL').all();
  const marquer = db.prepare('INSERT OR IGNORE INTO synthese_flux_migrations(modele_id) VALUES (?)');
  const ecrire = db.prepare(`UPDATE syntheses_modeles
    SET definition_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?`);
  let convertis = 0;
  let dejaFlux = 0;
  let ignores = 0;

  db.transaction(() => {
    for (const ligne of lignes) {
      let definition;
      try {
        definition = JSON.parse(ligne.definition_json);
      } catch {
        ignores += 1;
        continue;
      }
      if (definition?.layout?.schema_version === 2) {
        marquer.run(ligne.id);
        dejaFlux += 1;
        continue;
      }
      const flux = convertirEnFlux(definition, definition?.layout);
      ecrire.run(JSON.stringify({ ...definition, layout: flux }), ligne.id);
      marquer.run(ligne.id);
      convertis += 1;
    }
  })();

  if (convertis) logger?.info?.(`Synthèses V15 : ${convertis} définition(s) convertie(s) au flux`);
  return { convertis, dejaFlux, ignores, modeles: lignes.length };
}
