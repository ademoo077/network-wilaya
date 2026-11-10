import bcrypt from 'bcryptjs';
import { todayAlgiers } from '@anm/shared';
import { createAnomalie, updateAnomalie } from '../../server/src/services/anomalies.js';

export function seedBrowser(db, dataset) {
  const password = 'E2E-Alger-2026';
  const hash = bcrypt.hashSync(password, 4);
  for (const role of ['admin', 'operateur', 'lecteur']) {
    db.prepare(`INSERT INTO users(username, full_name, password_hash, role, must_change_password)
      VALUES (?, ?, ?, ?, 0) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash, must_change_password=0`)
      .run(role, `[DEMO] ${role}`, hash, role);
  }
  if (dataset === 'empty') return {};
  const user = db.prepare("SELECT id FROM users WHERE username='admin'").get();
  const daira = Number(db.prepare('INSERT INTO dairas(name_fr,name_ar) VALUES (?,?)').run('[DEMO] Daïra', '[DEMO] دائرة').lastInsertRowid);
  const commune = Number(db.prepare('INSERT INTO communes(daira_id,name_fr,name_ar) VALUES (?,?,?)').run(daira, '[DEMO] Commune', '[DEMO] بلدية').lastInsertRowid);
  const secondDaira = Number(db.prepare('INSERT INTO dairas(name_fr,name_ar) VALUES (?,?)').run('[DEMO] Autre daïra', '[DEMO] دائرة أخرى').lastInsertRowid);
  const secondCommune = Number(db.prepare('INSERT INTO communes(daira_id,name_fr,name_ar) VALUES (?,?,?)').run(secondDaira, '[DEMO] Autre commune', '[DEMO] بلدية أخرى').lastInsertRowid);
  const epic = Number(db.prepare('INSERT INTO epics(name) VALUES (?)').run('[DEMO] EPIC').lastInsertRowid);
  const agent = Number(db.prepare('INSERT INTO agents(full_name) VALUES (?)').run('[DEMO] Agent').lastInsertRowid);
  const type = db.prepare('SELECT id, domaine_id FROM types_anomalie ORDER BY id LIMIT 1').get();
  const geometry = { type: 'Polygon', coordinates: [[[3.04,36.74],[3.08,36.74],[3.08,36.77],[3.04,36.77],[3.04,36.74]]] };
  db.prepare('INSERT INTO limites_communes(commune_id,geojson,min_lat,min_lng,max_lat,max_lng) VALUES (?,?,?,?,?,?)')
    .run(commune, JSON.stringify(geometry), 36.74, 3.04, 36.77, 3.08);
  const payload = { domaine_id: type.domaine_id, type_id: type.id, daira_id: daira, commune_id: commune,
    date_signalement: todayAlgiers(), observations: '[DEMO] Signalement de test', agent_id: agent, epic_id: epic, verification: 'confirmee' };
  const ids = [];
  for (let index = 0; index < 3; index += 1) {
    const item = createAnomalie(db, { ...payload, lien_url: `https://facebook.com/posts/demo-${index}`,
      gps: index === 2 ? null : { lat: 36.7538 + index * 0.0001, lng: 3.0588 }, statut: index === 1 ? 'traite' : 'non_traite' }, user.id);
    ids.push(item.id);
  }
  updateAnomalie(db, ids[0], { version: 1, priorite: 'haute', adresse_texte: '[DEMO] Rue', lieu_dit: '[DEMO] Place' }, user.id);
  return { ids, daira, commune, secondDaira, secondCommune, epic, agent, type: type.id, domaine: type.domaine_id };
}
