import db from '../db/database.js';

export function listDomaines() {
  const rows = db.prepare('SELECT id, name_ar, name_fr, ordre, actif FROM domaines ORDER BY ordre').all();
  return rows;
}

export function listTypes(domaineId) {
  const rows = domaineId
    ? db.prepare('SELECT id, domaine_id, name_ar, name_fr, ordre, actif FROM types_anomalie WHERE domaine_id = ? ORDER BY ordre').all(domaineId)
    : db.prepare('SELECT id, domaine_id, name_ar, name_fr, ordre, actif FROM types_anomalie ORDER BY domaine_id, ordre').all();
  return rows;
}

export function listDairas() {
  const rows = db.prepare('SELECT id, name_fr, name_ar, actif FROM dairas ORDER BY id').all();
  return rows;
}

export function listCommunes(dairaId) {
  const rows = dairaId ? db.prepare('SELECT id, daira_id, name_fr, name_ar, actif FROM communes WHERE daira_id = ? ORDER BY id').all(dairaId) : db.prepare('SELECT id, daira_id, name_fr, name_ar, actif FROM communes ORDER BY id').all();
  return rows;
}

export function listEpics() {
  const rows = db.prepare('SELECT id, name, sigle, contact_nom, contact_tel, actif FROM epics ORDER BY id').all();
  return rows;
}

export function listAgents() {
  const rows = db.prepare('SELECT id, full_name, matricule, telephone, zone_daira_id, actif FROM agents ORDER BY id').all();
  return rows;
}
