import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth, requireAdmin, requireWrite } from '../middleware/auth.js';
import { asyncHandler, badRequest } from '../utils/errors.js';
import { audit } from '../services/audit.js';
import { affecterAgent, getActiveTitulaire, getActiveSuppleant, reaffecterDaïra, backfillAffectations, importAffectationsCSV } from '../services/agentAssignment.js';

const router = Router();

// GET /admin/affectations — liste des 14 daïras avec titulaire, suppléant, charge
router.get('/admin/affectations', requireAuth, asyncHandler(async (req, res) => {
  const db = getDb();
  const dairas = db.prepare(`
    SELECT d.id, d.name_fr, d.name_ar
    FROM dairas d
    WHERE d.actif = 1
    ORDER BY d.name_fr
  `).all();

  const result = [];
  for (const d of dairas) {
    const titulaire = getActiveTitulaire(db, d.id);
    const suppleant = getActiveSuppleant(db, d.id);
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN statut = 'non_traite' THEN 1 ELSE 0 END) AS non_traite,
        SUM(CASE WHEN statut = 'en_cours' THEN 1 ELSE 0 END) AS en_cours,
        SUM(CASE WHEN agent_id IS NULL THEN 1 ELSE 0 END) AS non_affectees
      FROM anomalies
      WHERE daira_id = ? AND deleted_at IS NULL
    `).get(d.id);

    result.push({
      daira: { id: d.id, name_fr: d.name_fr, name_ar: d.name_ar },
      titulaire: titulaire ? { id: titulaire.id, full_name: titulaire.full_name, matricule: titulaire.matricule } : null,
      suppleant: suppleant ? { id: suppleant.id, full_name: suppleant.full_name, matricule: suppleant.matricule } : null,
      stats,
      complet: Boolean(titulaire && suppleant)
    });
  }

  const coverage = result.filter(r => r.titulaire).length;
  res.json({ items: result, coverage: `${coverage} / ${result.length}` });
}));

// GET /admin/affectations/:dairaId/historique — historique des affectations d'une daïra
router.get('/admin/affectations/:dairaId/historique', requireAuth, asyncHandler(async (req, res) => {
  const db = getDb();
  const dairaId = Number(req.params.dairaId);
  const history = db.prepare(`
    SELECT aa.*, a.full_name AS agent_nom, a.matricule AS agent_matricule,
           u.full_name AS cree_par_nom
    FROM affectations_agents aa
    JOIN agents a ON a.id = aa.agent_id
    LEFT JOIN users u ON u.id = aa.cree_par
    WHERE aa.daira_id = ?
    ORDER BY aa.created_at DESC
  `).all(dairaId);
  res.json({ items: history });
}));

// POST /admin/affectations/apercu-reaffectation — aperçu avant réaffectation en masse
router.post('/admin/affectations/apercu-reaffectation', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDb();
  const { daira_id, new_agent_id, include_traitees } = req.body;
  if (!daira_id || !new_agent_id) throw badRequest('daira_id et new_agent_id requis');

  const agent = db.prepare('SELECT id, full_name FROM agents WHERE id = ? AND actif = 1').get(new_agent_id);
  if (!agent) throw badRequest('Agent inactif ou introuvable');

  const statuts = include_traitees ? ['non_traite', 'en_cours', 'traite'] : ['non_traite', 'en_cours'];
  const placeholders = statuts.map(() => '?').join(',');
  const anomalies = db.prepare(`
    SELECT id, reference, agent_id, agent_source, statut
    FROM anomalies
    WHERE daira_id = ? AND deleted_at IS NULL AND statut IN (${placeholders})
  `).all(daira_id, ...statuts);

  const toReassign = anomalies.filter(a => a.agent_source !== 'manuel' || a.agent_id !== new_agent_id);
  const manuelKept = anomalies.filter(a => a.agent_source === 'manuel' && a.agent_id !== new_agent_id);

  res.json({
    daira_id,
    new_agent: { id: agent.id, full_name: agent.full_name },
    total_anomalies: anomalies.length,
    will_reassign: toReassign.length,
    will_keep_manuel: manuelKept.length,
    details: {
      reassign: toReassign.map(a => ({ id: a.id, reference: a.reference, current_agent_id: a.agent_id, source: a.agent_source })),
      keep_manuel: manuelKept.map(a => ({ id: a.id, reference: a.reference, current_agent_id: a.agent_id }))
    }
  });
}));

// POST /admin/affectations/reaffecter — exécution de la réaffectation
router.post('/admin/affectations/reaffecter', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDb();
  const { daira_id, new_agent_id, user_id } = req.body;
  if (!daira_id || !new_agent_id) throw badRequest('daira_id et new_agent_id requis');

  const result = reaffecterDaïra(db, daira_id, new_agent_id, user_id || req.user.id);
  
  audit(req, 'AFFECTATION_REAFFECTE_DAIRA', { 
    entite: 'affectations_agents', 
    details: { daira_id, new_agent_id, ...result } 
  });
  
  res.json({ item: result });
}));

// POST /admin/affectations/import — import CSV d'affectations
router.post('/admin/affectations/import', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDb();
  const { csv } = req.body;
  if (!csv) throw badRequest('CSV requis');

  const result = importAffectationsCSV(db, csv, req.user.id);
  
  audit(req, 'AFFECTATION_IMPORT', { 
    entite: 'affectations_agents', 
    details: result 
  });
  
  res.json({ item: result });
}));

// POST /admin/affectations/backfill-preview — aperçu du backfill
router.post('/admin/affectations/backfill-preview', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDb();
  const { include_traitees } = req.body;
  const statuts = include_traitees ? ['non_traite', 'en_cours', 'traite'] : ['non_traite', 'en_cours'];
  const placeholders = statuts.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN daira_id IS NOT NULL THEN 1 ELSE 0 END) AS avec_daira,
      SUM(CASE WHEN daira_id IS NULL THEN 1 ELSE 0 END) AS sans_daira
    FROM anomalies
    WHERE agent_id IS NULL AND deleted_at IS NULL AND statut IN (${placeholders})
  `).all(...statuts);
  res.json({ item: { total: rows[0].total, avec_daira: rows[0].avec_daira, sans_daira: rows[0].sans_daira } });
}));

// POST /admin/affectations/backfill — affecter les anomalies existantes sans agent
router.post('/admin/affectations/backfill', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDb();
  const { include_traitees } = req.body;
  
  const result = backfillAffectations(db, { includeTraitees: include_traitees, user_id: req.user.id });
  
  audit(req, 'AFFECTATION_BACKFILL', { 
    entite: 'anomalies', 
    details: result 
  });
  
  res.json({ item: result });
}));

// PATCH /anomalies/:id/agent — affectation manuelle d'un agent (admin/opérateur)
router.patch('/anomalies/:id/agent', requireWrite, asyncHandler(async (req, res) => {
  const db = getDb();
  const { agent_id, motif } = req.body;
  const anomalieId = Number(req.params.id);

  if (!agent_id) throw badRequest('agent_id requis');
  if (!motif || !motif.trim()) throw badRequest('Motif obligatoire pour affectation manuelle');

  const agent = db.prepare('SELECT id FROM agents WHERE id = ? AND actif = 1').get(agent_id);
  if (!agent) throw badRequest('Agent inactif ou introuvable');

  const result = affecterAgent(db, anomalieId, { 
    manualAgentId: agent_id, 
    manualMotif: motif, 
    user_id: req.user.id,
    skipIfManuel: false // force même si déjà manuel
  });

  audit(req, 'AGENT_AFFECTE_MANUEL', { 
    entite: 'anomalies', 
    entiteId: anomalieId, 
    details: { agent_id, motif, ...result } 
  });

  const updated = getAnomalie(db, anomalieId);
  res.json({ item: updated });
}));

function getAnomalie(db, id) {
  return db.prepare(`
    SELECT a.*, ag.full_name AS agent_nom, ag.matricule AS agent_matricule
    FROM anomalies a
    LEFT JOIN agents ag ON ag.id = a.agent_id
    WHERE a.id = ?
  `).get(id);
}

export default router;