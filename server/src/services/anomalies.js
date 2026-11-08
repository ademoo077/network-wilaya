import { normaliserUrl, todayAlgiers } from '@anm/shared';
import { conflict, business, notFound } from '../utils/errors.js';
import { getAnomalieRaw, getAnomalie, findDuplicateMatches } from './anomalyRead.js';
import { validerEtat } from './etat.js';
import { searchNormForAnomaly } from './searchNorm.js';

const FIELDS = [
  'plateforme', 'lien_url', 'lien_normalise', 'date_publication', 'date_signalement',
  'domaine_id', 'type_id', 'daira_id', 'commune_id', 'adresse_texte', 'lieu_dit',
  'gps_lat', 'gps_lng', 'verification', 'agent_id', 'date_verification', 'statut',
  'epic_id', 'intervenant_autre', 'date_intervention', 'date_traitement', 'priorite', 'observations',
];

const HISTORY_FIELDS = [
  'plateforme', 'lien_url', 'date_publication', 'date_signalement', 'domaine_id', 'type_id',
  'daira_id', 'commune_id', 'adresse_texte', 'lieu_dit', 'verification', 'agent_id',
  'date_verification', 'statut', 'epic_id', 'intervenant_autre', 'date_intervention',
  'date_traitement', 'priorite', 'observations',
];

export { validerEtat };

export function assertIntegrite(db, state) {
  const type = db.prepare('SELECT id, domaine_id FROM types_anomalie WHERE id = ?').get(state.type_id);
  if (!type) throw business('Type d’anomalie introuvable', 'TYPE_INVALIDE', { type_id: 'Type introuvable' });
  if (Number(type.domaine_id) !== Number(state.domaine_id)) {
    throw business('Le type ne correspond pas à la catégorie', 'INTEGRITE_TYPE', { type_id: 'Type hors de la catégorie' });
  }
  const commune = db.prepare('SELECT id, daira_id FROM communes WHERE id = ?').get(state.commune_id);
  if (!commune) throw business('Commune introuvable', 'COMMUNE_INVALIDE', { commune_id: 'Commune introuvable' });
  if (Number(commune.daira_id) !== Number(state.daira_id)) {
    throw business('La commune ne correspond pas à la daïra', 'INTEGRITE_COMMUNE', { commune_id: 'Commune hors de la daïra' });
  }
  if (state.agent_id && !db.prepare('SELECT id FROM agents WHERE id = ?').get(state.agent_id)) {
    throw business('Agent introuvable', 'AGENT_INVALIDE', { agent_id: 'Agent introuvable' });
  }
  if (state.epic_id && !db.prepare('SELECT id FROM epics WHERE id = ?').get(state.epic_id)) {
    throw business('EPIC introuvable', 'EPIC_INVALIDE', { epic_id: 'EPIC introuvable' });
  }
}

function normalizeLink(data) {
  if (data.lien_url === undefined || data.lien_url === null) return data;
  const parsed = normaliserUrl(data.lien_url);
  if (!parsed.ok) {
    throw business('Lien invalide : une URL http(s) est attendue', 'LIEN_INVALIDE', { lien_url: 'URL http(s) invalide' });
  }
  return {
    ...data,
    lien_url: String(data.lien_url).trim(),
    lien_normalise: parsed.url,
    plateforme: data.plateforme || parsed.plateforme,
  };
}

function checkDoublons(db, state, { force = false, excludeId = null } = {}) {
  const matches = findDuplicateMatches(db, state.lien_normalise, excludeId);
  if (!matches.length) return;
  const strict = matches.find((m) => Number(m.type_id) === Number(state.type_id) && Number(m.commune_id) === Number(state.commune_id));
  if (strict) {
    throw conflict('DUPLICATE_STRICT', 'Une anomalie identique existe déjà (même lien, même type, même commune)', matches);
  }
  if (!force) {
    throw conflict('DUPLICATE_LINK', 'Ce lien est déjà utilisé par d’autres anomalies', matches);
  }
}

function nextReference(db, today) {
  const year = today.slice(0, 4);
  const key = `anm-${year}`;
  const row = db.prepare(`INSERT INTO compteurs(cle, valeur) VALUES (?, 1)
    ON CONFLICT(cle) DO UPDATE SET valeur = valeur + 1
    RETURNING valeur`).get(key);
  return `ANM-${year}-${String(row.valeur).padStart(5, '0')}`;
}

function applyGps(target, data) {
  if (data.gps === undefined) return;
  if (data.gps === null) {
    target.gps_lat = null;
    target.gps_lng = null;
  } else {
    target.gps_lat = Math.round(Number(data.gps.lat) * 1e6) / 1e6;
    target.gps_lng = Math.round(Number(data.gps.lng) * 1e6) / 1e6;
  }
}

export function createAnomalie(db, input, userId, settings = {}) {
  const today = settings.today || todayAlgiers();
  let data = normalizeLink({ ...input });
  data = {
    ...data,
    date_signalement: data.date_signalement || today,
    priorite: data.priorite || 'normale',
    observations: data.observations ? String(data.observations).trim() || null : null,
  };
  const state = { ...data, gps_lat: null, gps_lng: null, saisi_par: userId };
  applyGps(state, data);
  assertIntegrite(db, state);
  checkDoublons(db, state, { force: Boolean(input.force_duplicate) });
  const etat = validerEtat(state, {
    today,
    exigerVerification: settings.exigerVerification !== false,
  });
  if (settings.dryRun) {
    return { ...state, ...etat, id: null, reference: null, dryRun: true };
  }
  const id = db.transaction(() => {
    const reference = nextReference(db, today);
    const row = {
      ...state, ...etat, reference, search_norm: '',
      saisi_par: userId,
    };
    const columns = ['reference', 'plateforme', 'lien_url', 'lien_normalise', 'date_publication',
      'date_signalement', 'domaine_id', 'type_id', 'daira_id', 'commune_id', 'adresse_texte',
      'lieu_dit', 'gps_lat', 'gps_lng', 'verification', 'agent_id', 'date_verification',
      'statut', 'epic_id', 'intervenant_autre', 'date_intervention', 'date_traitement',
      'priorite', 'observations', 'search_norm', 'saisi_par'];
    const values = columns.map((c) => row[c] === undefined ? null : row[c]);
    const res = db.prepare(`INSERT INTO anomalies(${columns.join(', ')})
                            VALUES (${columns.map(() => '?').join(', ')})`).run(...values);
    const newId = res.lastInsertRowid;
    db.prepare(`INSERT INTO anomalie_historique(anomalie_id, champ, nouvelle_valeur, motif, user_id)
                VALUES (?, 'creation', ?, ?, ?)`).run(newId, reference, input.motif || null, userId);
    db.prepare('UPDATE anomalies SET search_norm = ? WHERE id = ?').run(searchNormForAnomaly(db, newId), newId);
    return newId;
  })();
  return getAnomalie(db, id);
}

function valueLabel(db, field, value) {
  if (value === null || value === undefined || value === '') return null;
  const lookups = {
    domaine_id: ['domaines', 'name_fr', 'name_ar'],
    type_id: ['types_anomalie', 'name_fr', 'name_ar'],
    daira_id: ['dairas', 'name_fr', 'name_ar'],
    commune_id: ['communes', 'name_fr', 'name_ar'],
    agent_id: ['agents', 'full_name', null],
    epic_id: ['epics', 'name', null],
  };
  const cfg = lookups[field];
  if (!cfg) return String(value);
  const [table, colFr, colAr] = cfg;
  const row = db.prepare(`SELECT ${colFr} AS a${colAr ? `, ${colAr} AS b` : ''} FROM ${table} WHERE id = ?`).get(value);
  if (!row) return String(value);
  return String(row.a || (colAr ? row.b : '') || value);
}

function diffAnomalie(db, before, after) {
  const changes = [];
  for (const field of HISTORY_FIELDS) {
    const oldValue = before[field] ?? null;
    const newValue = after[field] ?? null;
    if (String(oldValue ?? '') !== String(newValue ?? '')) {
      changes.push({ champ: field, ancienne: valueLabel(db, field, oldValue), nouvelle: valueLabel(db, field, newValue) });
    }
  }
  if (String(before.gps_lat ?? '') !== String(after.gps_lat ?? '') || String(before.gps_lng ?? '') !== String(after.gps_lng ?? '')) {
    changes.push({
      champ: 'gps',
      ancienne: before.gps_lat === null ? null : `${before.gps_lat}, ${before.gps_lng}`,
      nouvelle: after.gps_lat === null ? null : `${after.gps_lat}, ${after.gps_lng}`,
    });
  }
  return changes;
}

export function updateAnomalie(db, id, data, userId, settings = {}) {
  const current = getAnomalieRaw(db, id);
  if (!current || current.deleted_at) throw notFound('Anomalie introuvable');
  if (Number(data.version) !== Number(current.version)) {
    throw conflict('VERSION_CONFLICT', 'Cette fiche a été modifiée par un autre utilisateur — rechargez');
  }
  let input = data;
  if (data.lien_url !== undefined) input = normalizeLink(data);
  const merged = { ...current };
  for (const field of FIELDS) {
    if (input[field] !== undefined && !['gps_lat', 'gps_lng'].includes(field)) merged[field] = input[field];
  }
  if (input.lien_normalise !== undefined) merged.lien_normalise = input.lien_normalise;
  applyGps(merged, data);
  if (input.lien_url !== undefined && !data.plateforme && input.lien_normalise !== current.lien_normalise) {
    merged.plateforme = normaliserUrl(input.lien_url).plateforme || merged.plateforme;
  }
  assertIntegrite(db, merged);
  const linkChanged = input.lien_url !== undefined || data.type_id !== undefined || data.commune_id !== undefined;
  if (linkChanged) {
    checkDoublons(db, merged, { force: Boolean(data.force_duplicate), excludeId: id });
  }
  const etat = validerEtat(merged, {
    today: settings.today || todayAlgiers(),
    previous: current,
    motif: data.motif,
    exigerVerification: settings.exigerVerification !== false,
  });
  const next = { ...merged, ...etat };
  const changes = diffAnomalie(db, current, next);
  db.transaction(() => {
    const columns = FIELDS.filter((f) => f !== 'lien_normalise');
    db.prepare(`UPDATE anomalies SET ${columns.map((c) => `${c} = ?`).join(', ')},
                lien_normalise = ?, version = version + 1,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
      .run(...columns.map((c) => next[c] ?? null), next.lien_normalise, id);
    const stmt = db.prepare(`INSERT INTO anomalie_historique(anomalie_id, champ, ancienne_valeur, nouvelle_valeur, motif, user_id)
                             VALUES (?, ?, ?, ?, ?, ?)`);
    for (const change of changes) stmt.run(id, change.champ, change.ancienne, change.nouvelle, data.motif || null, userId);
    db.prepare('UPDATE anomalies SET search_norm = ? WHERE id = ?').run(searchNormForAnomaly(db, id), id);
  })();
  return { item: getAnomalie(db, id), changes };
}

export function deleteAnomalie(db, id, userId, motif = null) {
  const current = getAnomalieRaw(db, id);
  if (!current || current.deleted_at) throw notFound('Anomalie introuvable');
  db.prepare(`UPDATE anomalies SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
              deleted_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), version = version + 1
              WHERE id = ?`).run(userId, id);
  db.prepare(`INSERT INTO anomalie_historique(anomalie_id, champ, ancienne_valeur, nouvelle_valeur, motif, user_id)
              VALUES (?, 'suppression', 'active', 'corbeille', ?, ?)`).run(id, motif, userId);
  return { id };
}

export function restoreAnomalie(db, id, userId) {
  const current = getAnomalieRaw(db, id);
  if (!current) throw notFound('Anomalie introuvable');
  if (!current.deleted_at) throw business('Cette anomalie n’est pas dans la corbeille', 'NON_SUPPRIMEE');
  db.prepare(`UPDATE anomalies SET deleted_at = NULL, deleted_by = NULL,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), version = version + 1 WHERE id = ?`).run(id);
  db.prepare(`INSERT INTO anomalie_historique(anomalie_id, champ, ancienne_valeur, nouvelle_valeur, user_id)
              VALUES (?, 'restauration', 'corbeille', 'active', ?)`).run(id, userId);
  return getAnomalie(db, id);
}

export function bulkStatut(db, payload, userId, settings = {}) {
  const ok = [];
  const echecs = [];
  for (const id of payload.ids) {
    try {
      const current = getAnomalieRaw(db, id);
      if (!current || current.deleted_at) throw notFound(`Anomalie ${id} introuvable`);
      updateAnomalie(db, id, {
        version: current.version,
        statut: payload.statut,
        epic_id: payload.epic_id,
        intervenant_autre: payload.intervenant_autre,
        date_intervention: payload.date_intervention,
        date_traitement: payload.date_traitement,
        motif: payload.motif || 'Action groupée',
      }, userId, settings);
      ok.push(id);
    } catch (error) {
      echecs.push({ id, code: error.code || 'ERREUR', message: error.message });
    }
  }
  return { ok, echecs };
}

export function checkLink(db, rawUrl) {
  const parsed = normaliserUrl(rawUrl);
  if (!parsed.ok) throw business('Lien invalide : une URL http(s) est attendue', 'LIEN_INVALIDE', { url: 'URL invalide' });
  return { plateforme: parsed.plateforme, lien_normalise: parsed.url, matches: findDuplicateMatches(db, parsed.url) };
}
