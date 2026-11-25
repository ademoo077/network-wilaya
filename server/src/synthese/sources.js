/** V19 — liste blanche de domaines pour les sources citées manuellement. */
const DOMAINE = /^(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

export function normaliserDomaine(valeur) {
  const domaine = String(valeur || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '').replace(/^\*\./, '');
  if (!DOMAINE.test(domaine)) throw new Error('Domaine invalide');
  return domaine;
}

export function listSources(db) {
  return db.prepare('SELECT id, domaine, created_at FROM synthese_sources_autorisees ORDER BY domaine').all();
}

export function addSource(db, user, valeur) {
  const domaine = normaliserDomaine(valeur);
  db.prepare('INSERT OR IGNORE INTO synthese_sources_autorisees(domaine, ajoute_par) VALUES (?, ?)').run(domaine, user?.id ?? null);
  return listSources(db).find((item) => item.domaine === domaine);
}

export function removeSource(db, id) {
  db.prepare('DELETE FROM synthese_sources_autorisees WHERE id = ?').run(Number(id));
  return listSources(db);
}
