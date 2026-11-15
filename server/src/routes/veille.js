import { Router } from 'express';
import {
  normalizeForMatch, settingsSchema, veilleAliasSchema, veilleAnalyseSchema, veilleDecisionSchema,
  veilleLexiquePatchSchema, veilleQuerySchema, zodFields,
} from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAdmin, requireAuth, requireWrite } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/errors.js';
import { audit } from '../services/audit.js';
import { getParams, setParams } from '../services/settings.js';
import { getElement, listElements, prefillFromElement, rejectElement, retainElement, undoElement } from '../veille/triage.js';
import { decideLearning, listLearning, refreshLearning } from '../veille/learning.js';
import { veilleContext } from '../veille/context.js';
import { analyserElement } from '../veille/analyze.js';
import { ensureVeilleJobs } from '../veille/scheduler.js';
import { secretsKeyConfigured } from '../veille/secrets.js';
import { captureTokenSchema, createCaptureToken, listCaptureTokens, revokeCaptureToken } from '../veille/tokens.js';
import { handleCapture } from '../veille/capture.js';
import {
  collectNow, connectorCatalog, createSource, deleteSource, listRuns, listSources, testSource, updateSource,
} from '../veille/sources.js';
import { importElements } from '../veille/import.js';
import { complianceOverview, eraseElements, maybePurge } from '../veille/compliance.js';
import { veilleDashboard } from '../veille/stats.js';
import { listAlerts, markAlertRead, markAllAlertsRead, refreshAlerts } from '../veille/alerts.js';

const router = Router();

function idOf(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw badRequest('Identifiant invalide');
  return id;
}

router.get('/status', requireAuth, (req, res) => {
  const db = getDb();
  const params = getParams(db);
  refreshAlerts(db);
  const counts = Object.fromEntries(db.prepare('SELECT statut, COUNT(*) AS c FROM veille_elements GROUP BY statut').all()
    .map((row) => [row.statut, row.c]));
  const sources = db.prepare('SELECT COUNT(*) AS total, SUM(actif) AS actifs FROM veille_sources').get();
  const alertes = db.prepare('SELECT COUNT(*) AS c FROM veille_alertes WHERE lue = 0').get().c;
  res.json({ item: {
    activee: params.veille_activee === '1',
    sources: sources.total || 0, sources_actives: sources.actifs || 0, alertes_non_lues: alertes,
    elements: Object.values(counts).reduce((sum, count) => sum + count, 0), a_qualifier: counts.a_qualifier || 0,
    retenus: counts.retenu || 0, rejetes: counts.rejete || 0, ignores: counts.ignore || 0,
    apprentissages: db.prepare("SELECT COUNT(*) AS c FROM veille_apprentissages WHERE statut = 'propose'").get().c,
    secrets_configured: secretsKeyConfigured(),
  } });
});

router.get('/alertes', requireAuth, (req, res) => {
  const db = getDb();
  refreshAlerts(db);
  res.json({ items: listAlerts(db, { unreadOnly: req.query.non_lues === '1', limit: req.query.limit }) });
});

router.post('/alertes/tout-lues', requireWrite, (req, res) => {
  res.json({ item: { marquees: markAllAlertsRead(getDb()) } });
});

router.post('/alertes/:id/lue', requireWrite, (req, res) => {
  const id = idOf(req);
  if (!markAlertRead(getDb(), id)) throw notFound('Alerte introuvable');
  res.json({ item: { id } });
});

router.get('/tableau', requireAuth, (req, res) => {
  const days = Number(req.query.jours || 30);
  res.json({ item: veilleDashboard(getDb(), { days }) });
});

router.get('/settings', requireAdmin, (req, res) => {
  const params = getParams(getDb());
  res.json({ item: Object.fromEntries(Object.entries(params).filter(([key]) => key.startsWith('veille_'))) });
});

router.put('/settings', requireAdmin, (req, res) => {
  const db = getDb();
  const merged = { ...getParams(db), ...req.body };
  const parsed = settingsSchema.safeParse(merged);
  if (!parsed.success) throw badRequest('Paramètres Veille invalides', zodFields(parsed.error));
  const item = setParams(db, parsed.data);
  audit(req, 'PARAM_UPDATE', { entite: 'parametres_veille', details: req.body });
  res.json({ item: Object.fromEntries(Object.entries(item).filter(([key]) => key.startsWith('veille_'))) });
});

router.get('/references', requireAuth, (_req, res) => {
  const db = getDb();
  res.json({ item: {
    groupes: db.prepare('SELECT id, name_fr, name_ar FROM groupes_domaines ORDER BY name_fr COLLATE NOCASE').all(),
    domaines: db.prepare('SELECT id, name_fr, name_ar FROM domaines ORDER BY ordre, id').all(),
    dairas: db.prepare('SELECT id, name_fr, name_ar FROM dairas ORDER BY name_fr COLLATE NOCASE').all(),
    communes: db.prepare('SELECT id, daira_id, name_fr, name_ar FROM communes ORDER BY name_fr COLLATE NOCASE').all(),
  } });
});

router.get('/elements', requireAuth, (req, res) => {
  const parsed = veilleQuerySchema.safeParse(req.query);
  if (!parsed.success) throw badRequest('Filtres Veille invalides', zodFields(parsed.error));
  res.json(listElements(getDb(), parsed.data));
});

router.get('/elements/:id', requireAuth, (req, res) => {
  res.json({ item: getElement(getDb(), idOf(req)) });
});

router.post('/elements/:id/retenir', requireWrite, (req, res) => {
  const parsed = veilleDecisionSchema.safeParse(req.body || {});
  if (!parsed.success) throw badRequest('Décision invalide', zodFields(parsed.error));
  const result = retainElement(getDb(), idOf(req), req.user, parsed.data);
  audit(req, 'VEILLE_RETENU', { entite: 'veille_elements', entiteId: req.params.id, details: { commentaire: parsed.data.commentaire } });
  res.json({ item: result.item, prefill: result.prefill });
});

router.post('/elements/:id/rejeter', requireWrite, (req, res) => {
  const parsed = veilleDecisionSchema.safeParse(req.body || {});
  if (!parsed.success) throw badRequest('Motif invalide', zodFields(parsed.error));
  const result = rejectElement(getDb(), idOf(req), req.user, parsed.data);
  refreshLearning(getDb());
  audit(req, 'VEILLE_REJETE', { entite: 'veille_elements', entiteId: req.params.id, details: { raison: parsed.data.raison } });
  res.json({ item: result.item });
});

router.post('/elements/:id/annuler', requireWrite, (req, res) => {
  const result = undoElement(getDb(), idOf(req), req.user);
  audit(req, 'VEILLE_ANNULE', { entite: 'veille_elements', entiteId: req.params.id });
  res.json({ item: result.item });
});

router.get('/prefill/:id', requireAuth, (req, res) => {
  res.json({ item: prefillFromElement(getDb(), getElement(getDb(), idOf(req))) });
});

router.post('/analyser', requireWrite, (req, res) => {
  const parsed = veilleAnalyseSchema.safeParse(req.body || {});
  if (!parsed.success) throw badRequest('Texte invalide', zodFields(parsed.error));
  const db = getDb();
  const context = veilleContext(db);
  const analysis = analyserElement({ texte: parsed.data.texte, url: parsed.data.url }, context);
  res.json({ item: {
    langue: analysis.langue, score: analysis.score, confiance: analysis.confiance, priorite: analysis.priorite,
    urgent: analysis.urgent, statut: analysis.statut, suggestions: analysis.suggestions.map((suggestion) => ({
      groupe_id: suggestion.groupe_id, groupe_nom: context.groupNames.get(Number(suggestion.groupe_id)) || null,
      domaine_id: suggestion.domaine_id, type_id: suggestion.type_id, score: suggestion.score,
      confiance: suggestion.confidence, raisons: suggestion.raisons,
    })), correspondances: analysis.correspondances.map((match) => ({
      terme: match.terme, role: match.role, occurrences: match.occurrences, poids: match.poids,
    })), territoire: analysis.territoire,
  } });
});

router.get('/lexique', requireAuth, (req, res) => {
  const db = getDb();
  const where = [];
  const params = [];
  if (req.query.q) { where.push('(l.terme LIKE ? OR l.terme_norm LIKE ?)'); params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  if (req.query.role) { where.push('l.role = ?'); params.push(req.query.role); }
  if (req.query.actif !== undefined) { where.push('l.actif = ?'); params.push(Number(req.query.actif) ? 1 : 0); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const items = db.prepare(`SELECT l.*, g.name_fr AS groupe_nom, d.name_fr AS domaine_nom, t.name_fr AS type_nom
    FROM veille_lexique l LEFT JOIN groupes_domaines g ON g.id = l.groupe_id
    LEFT JOIN domaines d ON d.id = l.domaine_id LEFT JOIN types_anomalie t ON t.id = l.type_id
    ${clause} ORDER BY l.role, l.groupe_id, l.terme LIMIT 500`).all(...params);
  res.json({ items });
});

router.patch('/lexique/:id', requireAdmin, (req, res) => {
  const parsed = veilleLexiquePatchSchema.safeParse(req.body || {});
  if (!parsed.success) throw badRequest('Terme invalide', zodFields(parsed.error));
  const db = getDb();
  const current = db.prepare('SELECT * FROM veille_lexique WHERE id = ?').get(idOf(req));
  if (!current) throw notFound('Terme introuvable');
  const next = { ...current, ...parsed.data };
  db.prepare(`UPDATE veille_lexique SET poids = ?, actif = ?, groupe_id = ?, domaine_id = ?, type_id = ?,
    updated_at = ? WHERE id = ?`).run(next.poids, next.actif, next.groupe_id || null, next.domaine_id || null,
    next.type_id || null, new Date().toISOString(), current.id);
  audit(req, 'VEILLE_LEXIQUE_UPDATE', { entite: 'veille_lexique', entiteId: current.id, details: parsed.data });
  res.json({ item: db.prepare('SELECT * FROM veille_lexique WHERE id = ?').get(current.id) });
});

router.get('/alias', requireAuth, (req, res) => {
  res.json({ items: getDb().prepare(`SELECT a.*, c.name_fr AS commune_nom, d.name_fr AS daira_nom
    FROM veille_alias_lieux a LEFT JOIN communes c ON c.id = a.commune_id
    LEFT JOIN dairas d ON d.id = a.daira_id ORDER BY a.alias`).all() });
});

router.post('/alias', requireAdmin, (req, res) => {
  const parsed = veilleAliasSchema.safeParse(req.body || {});
  if (!parsed.success) throw badRequest('Alias invalide', zodFields(parsed.error));
  const db = getDb();
  const result = db.prepare(`INSERT OR IGNORE INTO veille_alias_lieux(alias, alias_norm, commune_id, daira_id, actif, origine)
    VALUES (?, ?, ?, ?, ?, 'admin')`).run(parsed.data.alias, normalizeForMatch(parsed.data.alias),
    parsed.data.commune_id || null, parsed.data.daira_id || null, parsed.data.actif);
  audit(req, 'VEILLE_ALIAS_UPDATE', { entite: 'veille_alias_lieux', details: parsed.data });
  res.status(result.changes ? 201 : 200).json({ item: db.prepare('SELECT * FROM veille_alias_lieux WHERE alias_norm = ?')
    .get(normalizeForMatch(parsed.data.alias)) });
});

router.delete('/alias/:id', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM veille_alias_lieux WHERE id = ?').run(idOf(req));
  audit(req, 'VEILLE_ALIAS_UPDATE', { entite: 'veille_alias_lieux', entiteId: req.params.id, details: { action: 'suppression' } });
  res.status(204).end();
});

router.get('/apprentissages', requireAuth, (_req, res) => res.json({ items: listLearning(getDb()) }));

router.post('/apprentissages/rafraichir', requireWrite, (req, res) => {
  const result = refreshLearning(getDb());
  audit(req, 'VEILLE_APPRENTISSAGE', { entite: 'veille_apprentissages', details: result });
  res.json({ item: result });
});

router.post('/apprentissages/:id/accepter', requireAdmin, (req, res) => {
  const item = decideLearning(getDb(), idOf(req), true, req.user);
  if (!item) throw notFound('Suggestion introuvable ou déjà traitée');
  audit(req, 'VEILLE_APPRENTISSAGE', { entite: 'veille_apprentissages', entiteId: req.params.id, details: { accepte: true } });
  res.json({ item });
});

router.post('/apprentissages/:id/refuser', requireAdmin, (req, res) => {
  const item = decideLearning(getDb(), idOf(req), false, req.user);
  if (!item) throw notFound('Suggestion introuvable ou déjà traitée');
  audit(req, 'VEILLE_APPRENTISSAGE', { entite: 'veille_apprentissages', entiteId: req.params.id, details: { accepte: false } });
  res.json({ item });
});

router.post('/jobs/relancer', requireAdmin, (req, res) => {
  ensureVeilleJobs(getDb());
  audit(req, 'VEILLE_COLLECTE', { entite: 'veille_jobs', details: { relance: true } });
  res.json({ item: { ok: true } });
});

router.get('/sources', requireAuth, (req, res) => {
  res.json({
    items: listSources(getDb(), { admin: req.user.role === 'admin' }),
    connecteurs: connectorCatalog(),
  });
});

router.post('/sources', requireAdmin, (req, res) => {
  const item = createSource(getDb(), req.body || {});
  audit(req, 'VEILLE_SOURCE_CREATE', { entite: 'veille_sources', entiteId: item.id, details: { type: item.type, nom: item.nom } });
  res.status(201).json({ item });
});

router.patch('/sources/:id', requireAdmin, (req, res) => {
  const item = updateSource(getDb(), idOf(req), req.body || {});
  audit(req, 'VEILLE_SOURCE_UPDATE', { entite: 'veille_sources', entiteId: item.id, details: req.body });
  res.json({ item });
});

router.delete('/sources/:id', requireAdmin, (req, res) => {
  const removed = deleteSource(getDb(), idOf(req));
  audit(req, 'VEILLE_SOURCE_DELETE', { entite: 'veille_sources', entiteId: removed.id });
  res.status(204).end();
});

router.post('/sources/:id/tester', requireAdmin, asyncHandler(async (req, res) => {
  const item = await testSource(getDb(), idOf(req));
  audit(req, 'VEILLE_SOURCE_TEST', { entite: 'veille_sources', entiteId: req.params.id, details: { ok: item.ok, code: item.code } });
  res.json({ item });
}));

router.post('/sources/:id/collecter', requireAdmin, asyncHandler(async (req, res) => {
  const item = await collectNow(getDb(), idOf(req));
  audit(req, 'VEILLE_COLLECTE', { entite: 'veille_sources', entiteId: req.params.id, details: item });
  res.json({ item });
}));

router.get('/sources/:id/runs', requireAuth, (req, res) => {
  res.json({ items: listRuns(getDb(), idOf(req), req.query.limit) });
});

router.post('/import', requireAdmin, (req, res) => {
  const raw = typeof req.body === 'string' ? req.body : req.body?.contenu;
  const item = importElements(getDb(), {
    text: raw, format: String(req.query.format || '').toLowerCase(), nom: req.query.nom,
  });
  audit(req, 'VEILLE_IMPORT', { details: { format: item.format, sourceId: item.source_id, newCount: item.newCount } });
  res.json({ item });
});

router.get('/conformite', requireAuth, (_req, res) => {
  res.json({ item: complianceOverview(getDb()) });
});

router.post('/purge', requireAdmin, (req, res) => {
  const item = maybePurge(getDb(), { force: true });
  audit(req, 'VEILLE_PURGE_MANUEL', { entite: 'veille_elements', details: item || {} });
  res.json({ item: item || { supprimes: 0, anonymises: 0 } });
});

router.post('/effacement', requireAdmin, (req, res) => {
  const id = req.body?.id ? Number(req.body.id) : null;
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : null;
  if ((!Number.isInteger(id) || id < 1) && !url) throw badRequest('Indiquez un identifiant ou une URL à effacer');
  if (url && url.length > 2000) throw badRequest('URL trop longue');
  const item = eraseElements(getDb(), {
    id: Number.isInteger(id) && id > 0 ? id : null, url,
    userId: req.user.id, username: req.user.username, motif: String(req.body?.motif || '').slice(0, 300) || null,
  });
  res.json({ item });
});

router.get('/capture-tokens', requireAuth, (req, res) => {
  res.json({ items: listCaptureTokens(getDb(), req.user.id) });
});

router.post('/capture-tokens', requireWrite, (req, res) => {
  const parsed = captureTokenSchema.safeParse(req.body || {});
  if (!parsed.success) throw badRequest('Nom de jeton invalide', zodFields(parsed.error));
  const result = createCaptureToken(getDb(), req.user.id, parsed.data.nom);
  audit(req, 'VEILLE_CAPTURE', { entite: 'veille_jetons', entiteId: result.item.id, details: { action: 'creation', nom: parsed.data.nom } });
  res.status(201).json({ item: result.item, token: result.token });
});

router.delete('/capture-tokens/:id', requireAuth, (req, res) => {
  const item = revokeCaptureToken(getDb(), req.user.id, idOf(req), { admin: req.user.role === 'admin' });
  audit(req, 'VEILLE_CAPTURE', { entite: 'veille_jetons', entiteId: item.id, details: { action: 'revocation' } });
  res.json({ item });
});

router.post('/capture', (req, res) => handleCapture(req, res));

export default router;
