import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { getDb } from '../db/database.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

const definitions = {
  domaines: { table: 'domaines', nameCol: 'name_ar', insertCols: ['name_ar', 'name_fr', 'ordre', 'actif'] },
  types: { table: 'types_anomalie', nameCol: 'name_ar', insertCols: ['domaine_id', 'name_ar', 'name_fr', 'ordre', 'actif'] },
  dairas: { table: 'dairas', nameCol: 'name_fr', insertCols: ['name_fr', 'name_ar', 'actif'] },
  communes: { table: 'communes', nameCol: 'name_fr', insertCols: ['daira_id', 'name_fr', 'name_ar', 'actif'] },
  epics: { table: 'epics', nameCol: 'name', insertCols: ['name', 'sigle', 'contact_nom', 'contact_tel', 'actif'] },
  agents: { table: 'agents', nameCol: 'full_name', insertCols: ['full_name', 'matricule', 'telephone', 'zone_daira_id', 'actif'] },
};

const schemas = {
  domaines: z.object({ nameAr: z.string().min(2), nameFr: z.string().optional(), ordre: z.number().int().optional(), actif: z.number().optional() }),
  types: z.object({ domaineId: z.number(), nameAr: z.string().min(2), nameFr: z.string().optional(), ordre: z.number().int().optional(), actif: z.number().optional() }),
  dairas: z.object({ nameFr: z.string().min(2), nameAr: z.string().min(2), actif: z.number().optional() }),
  communes: z.object({ dairaId: z.number(), nameFr: z.string().min(2), nameAr: z.string().min(2), actif: z.number().optional() }),
  epics: z.object({ name: z.string().min(2), sigle: z.string().optional(), contactNom: z.string().optional(), contactTel: z.string().optional(), actif: z.number().optional() }),
  agents: z.object({ fullName: z.string().min(2), matricule: z.string().optional(), telephone: z.string().optional(), zoneDairaId: z.number().optional(), actif: z.number().optional() }),
};

function validate(entite, body) {
  const result = schemas[entite].safeParse(body || {});
  if (!result.success) {
    const err = new Error('Donnees invalides');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    err.fields = result.error.flatten().fieldErrors;
    throw err;
  }
  return result.data;
}

function buildValues(entite, data) {
  const c = definitions[entite];
  const map = {
    domaines: { name_ar: data.nameAr, name_fr: data.nameFr ?? null, ordre: data.ordre ?? 0, actif: data.actif ?? 1 },
    types: { domaine_id: data.domaineId, name_ar: data.nameAr, name_fr: data.nameFr ?? null, ordre: data.ordre ?? 0, actif: data.actif ?? 1 },
    dairas: { name_fr: data.nameFr, name_ar: data.nameAr, actif: data.actif ?? 1 },
    communes: { daira_id: data.dairaId, name_fr: data.nameFr, name_ar: data.nameAr, actif: data.actif ?? 1 },
    epics: { name: data.name, sigle: data.sigle ?? null, contact_nom: data.contactNom ?? null, contact_tel: data.contactTel ?? null, actif: data.actif ?? 1 },
    agents: { full_name: data.fullName, matricule: data.matricule ?? null, telephone: data.telephone ?? null, zone_daira_id: data.zoneDairaId ?? null, actif: data.actif ?? 1 },
  };
  const cols = c.insertCols.filter((col) => mapKey(map, entite, col) !== undefined);
  const values = cols.map((col) => mapKey(map, entite, col));
  return { cols, values };
}

function mapKey(map, entite, col) {
  if (map[entite] && map[entite][col] !== undefined) return map[entite][col];
  return undefined;
}

function listRows(entite) {
  const def = definitions[entite];
  return getDb().prepare(`SELECT * FROM ${def.table} ORDER BY id`).all();
}

function createRow(entite, body) {
  const data = validate(entite, body);
  const def = definitions[entite];
  const { cols, values } = buildValues(entite, data);
  const info = getDb().prepare(`INSERT INTO ${def.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...values);
  const row = getDb().prepare(`SELECT * FROM ${def.table} WHERE id = ?`).get(Number(info.lastInsertRowid));
  logAudit({ userId: req_user_id(), action: 'REFERENCE_CREATE', entite, entiteId: row.id, details: row, ip: req_ip() });
  return row;
}

function updateRow(entite, id, body) {
  const data = validate(entite, body);
  const def = definitions[entite];
  const { cols, values } = buildValues(entite, data);
  if (!cols.length) {
    const err = new Error('Aucun champ modifiable fourni');
    err.status = 400;
    throw err;
  }
  const sets = cols.map((col) => `${col} = ?`);
  getDb().prepare(`UPDATE ${def.table} SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
  const row = getDb().prepare(`SELECT * FROM ${def.table} WHERE id = ?`).get(id);
  logAudit({ userId: req_user_id(), action: 'REFERENCE_UPDATE', entite, entiteId: id, details: row, ip: req_ip() });
  return row;
}

function req_user_id() { return Number(process.env.AUDIT_USER_FALLBACK || 0); }
function req_ip() { return null; }

router.get('/:entite', requireAuth, requireAdmin, (req, res) => {
  const entite = req.params.entite;
  if (!definitions[entite]) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Entite inconnue' } });
  }
  return res.json({ data: listRows(entite) });
});

router.post('/:entite', requireAuth, requireAdmin, (req, res) => {
  const entite = req.params.entite;
  if (!definitions[entite]) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Entite inconnue' } });
  }
  const row = createRow(entite, req.body);
  return res.status(201).json({ data: row });
});

router.patch('/:entite/:id', requireAuth, requireAdmin, (req, res) => {
  const entite = req.params.entite;
  if (!definitions[entite]) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Entite inconnue' } });
  }
  const row = updateRow(entite, Number(req.params.id), req.body);
  return res.json({ data: row });
});

router.patch('/:entite/:id/actif', requireAuth, requireAdmin, (req, res) => {
  const entite = req.params.entite;
  const id = Number(req.params.id);
  const def = definitions[entite];
  const nextActif = req.body?.actif === undefined ? 0 : Number(req.body.actif);
  getDb().prepare(`UPDATE ${def.table} SET actif = ? WHERE id = ?`).run(nextActif, id);
  const row = getDb().prepare(`SELECT * FROM ${def.table} WHERE id = ?`).get(id);
  logAudit({ userId: req_user_id(), action: 'REFERENCE_UPDATE', entite, entiteId: id, details: { actif: nextActif }, ip: req_ip() });
  return res.json({ data: row });
});

router.post('/import/taxonomie', requireAuth, requireAdmin, (req, res) => {
  const body = req.body || {};
  const insertedDomaines = [];
  const domaineIdsByNameAr = new Map();
  const domaines = Array.isArray(body.domaines) ? body.domaines : [];
  for (const d of domaines) {
    const nameAr = String(d?.nameAr || '');
    const existing = getDb().prepare('SELECT id FROM domaines WHERE name_ar = ?').get(nameAr);
    if (existing) {
      domaineIdsByNameAr.set(nameAr, Number(existing.id));
      continue;
    }
    const info = getDb().prepare('INSERT INTO domaines (name_ar, name_fr, ordre, actif) VALUES (?, ?, ?, 1)').run(nameAr, d?.nameFr || null, Number(d?.ordre) || 0);
    const row = getDb().prepare('SELECT * FROM domaines WHERE id = ?').get(Number(info.lastInsertRowid));
    domaineIdsByNameAr.set(nameAr, Number(row.id));
    insertedDomaines.push(row);
  }
  const insertedTypes = [];
  const types = Array.isArray(body.types) ? body.types : [];
  for (const t of types) {
    const nameAr = String(t?.nameAr || '');
    const domaineId = t?.domaineId ? Number(t.domaineId) : domaineIdsByNameAr.get(String(t?.domaineNameAr || ''));
    const existing = domaineId ? getDb().prepare('SELECT id FROM types_anomalie WHERE domaine_id = ? AND name_ar = ?').get(domaineId, nameAr) : null;
    if (existing) continue;
    const info = getDb().prepare('INSERT INTO types_anomalie (domaine_id, name_ar, name_fr, ordre, actif) VALUES (?, ?, ?, ?, 1)').run(domaineId, nameAr, t?.nameFr || null, Number(t?.ordre) || 0);
    const row = getDb().prepare('SELECT * FROM types_anomalie WHERE id = ?').get(Number(info.lastInsertRowid));
    insertedTypes.push(row);
  }
  logAudit({ userId: req_user_id(), action: 'TAXONOMIE_IMPORT', entite: 'taxonomie', entiteId: null, details: { insertedDomaines, insertedTypes }, ip: req_ip() });
  return res.json({ insertedDomaines, insertedTypes });
});

export default router;
