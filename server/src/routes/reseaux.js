import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  classifyUrl, extraireIdentiteSource, identifierRequestSchema, nomSuggere,
  rechercheSourcesQuerySchema, sourceIdentifiantSchema, sourceRapideSchema,
} from '@anm/shared';
import { getDb } from '../db/index.js';
import { config } from '../config/index.js';
import { requireAuth, requireWrite } from '../middleware/auth.js';
import { asyncHandler, badRequest, conflict, notFound } from '../utils/errors.js';
import { audit } from '../services/audit.js';
import { getParams } from '../services/settings.js';
import { resolveLink } from '../services/resolveLink.js';
import {
  creerOuTrouverSource, lierIdentifiant, rechercherSources, sourceParId, sourcesParIdentite,
} from '../services/sourceIdentifiants.js';

const router = Router();
const parse = (schema, value) => {
  const resultat = schema.safeParse(value);
  if (!resultat.success) throw badRequest('Données invalides', resultat.error.flatten().fieldErrors);
  return resultat.data;
};
const limite = rateLimit({
  windowMs: 60 * 1000,
  max: config.env === 'test' ? 100000 : 30,
  keyGenerator: (req) => String(req.user?.id || req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    error: { code: 'TROP_DE_REQUETES', message: 'Trop de détections — réessayez dans une minute' },
  }),
});

router.use(requireAuth);

/** Résolution de lien court : optionnelle, non bloquante, jamais une_SOURCE devinée. */
async function resolutionOptionnelle(url, identite) {
  if (identite.statut === 'identifie') return { tentee: false, ok: false };
  const db = getDb();
  const params = getParams(db);
  if ((params.resolution_liens || 'cartes') !== 'tous' || classifyUrl(url).type !== 'social') {
    return { tentee: false, ok: false };
  }
  try {
    const resultat = await resolveLink(url, { mode: 'tous', bbox: params.gps_bbox });
    if (!resultat.ok || !resultat.urlFinale) return { tentee: true, ok: false };
    const finale = extraireIdentiteSource(resultat.urlFinale);
    return finale.statut === 'identifie'
      ? { tentee: true, ok: true, identite: finale }
      : { tentee: true, ok: false };
  } catch {
    return { tentee: true, ok: false };
  }
}

router.post('/identifier', limite, asyncHandler(async (req, res) => {
  const { url } = parse(identifierRequestSchema, req.body);
  const identite = extraireIdentiteSource(url);
  const db = getDb();
  const correspondance = sourcesParIdentite(db, identite)[0] || null;
  const supprimee = !correspondance
    ? sourcesParIdentite(db, identite, { inclureCorbeille: true }).find((item) => item.deleted_at) || null
    : null;
  const nom = nomSuggere(identite) || identite.identifiants[0]?.valeur || '';
  const similaires = !correspondance && nom
    ? rechercherSources(db, { q: nom, reseau: identite.reseau, limit: 3 }).slice(0, 3)
    : [];
  res.json({
    ...identite,
    correspondance,
    supprimee,
    similaires,
    resolution: await resolutionOptionnelle(url, identite),
  });
}));

router.get('/recherche', (req, res) => {
  const query = parse(rechercheSourcesQuerySchema, req.query);
  const recents = query.recents.split(',').map((part) => part.trim()).filter(Boolean);
  res.json({ items: rechercherSources(getDb(), { ...query, recents }) });
});

router.post('/rapide', requireWrite, (req, res) => {
  const data = parse(sourceRapideSchema, req.body);
  const resultat = creerOuTrouverSource(getDb(), data, req.user);
  if (resultat.concurrence) {
    throw conflict('RESEAU_EXISTANT', 'Cette page vient d’être ajoutée par une autre session', { item: resultat.item });
  }
  const statut = resultat.created ? 201 : 200;
  audit(req, 'RESEAU_RAPIDE', {
    entite: 'comptes_sociaux', entiteId: resultat.item.id,
    details: { reseau: data.reseau, nature: data.nature, identifiants: data.identifiants?.length || 0, statut },
  });
  res.status(statut).json({ item: resultat.item, statut, alias: Boolean(resultat.alias) });
});

router.post('/:id/identifiants', requireWrite, (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) throw badRequest('Identifiant invalide');
  const data = parse(sourceIdentifiantSchema, req.body);
  const db = getDb();
  const id = Number(req.params.id);
  const source = db.prepare('SELECT plateforme FROM comptes_sociaux WHERE id=? AND deleted_at IS NULL').get(id);
  if (!source) throw notFound('Page introuvable');
  const resultat = lierIdentifiant(db, {
    sourceId: id, reseau: source.plateforme, type: data.type, valeur: data.valeur, userId: req.user.id,
  });
  audit(req, 'RESEAU_IDENTIFIANT', {
    entite: 'comptes_sociaux', entiteId: id,
    details: { type: data.type, cree: resultat.created },
  });
  res.json({ item: sourceParId(db, id) });
});

export default router;
