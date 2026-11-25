import { Router } from 'express';
import {
  syntheseModelePayloadSchema, validerDefinition, zodFields,
} from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAuth, requireRole, requireWrite } from '../middleware/auth.js';
import { asyncHandler, badRequest } from '../utils/errors.js';
import { audit } from '../services/audit.js';
import {
  archiveModele, cataloguePayload, createModele, duplicateModele, evaluerRequetes,
  getModele, listModeles, normaliserRequete, personnaliserModele, reinitialiserModele, updateModele,
} from '../services/syntheses.js';
import {
  createEdition, editionWorkbook, freezeEdition, getEdition, listEditions,
} from '../services/synthesesEditions.js';
import { getCharte, updateCharte } from '../synthese/charte.js';
import { nextNumero } from '../synthese/numerotation.js';
import { addSource, listSources, removeSource } from '../synthese/sources.js';

const router = Router();

function modelePayload(req) {
  const result = syntheseModelePayloadSchema.safeParse(req.body);
  if (!result.success) throw badRequest('Modèle invalide', zodFields(result.error));
  try {
    return { ...result.data, definition: validerDefinition(result.data.definition) };
  } catch (error) {
    throw badRequest(error.message, error.fields);
  }
}

function duplicationPayload(req) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const clean = {};
  if (body.nom !== undefined) clean.nom = String(body.nom).trim().slice(0, 200);
  if (body.portee !== undefined) {
    if (!['prive', 'equipe'].includes(body.portee)) throw badRequest('Portée invalide', { portee: 'prive ou equipe' });
    clean.portee = body.portee;
  }
  return clean;
}

function cleanBody(raw, allowed) {
  const body = raw && typeof raw === 'object' ? raw : {};
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) throw badRequest('Champ inconnu', { [unknown[0]]: 'Champ inconnu' });
  return body;
}

router.get('/charte', requireAuth, (_req, res) => {
  res.json({ item: getCharte(getDb()) });
});

router.patch('/charte', requireRole('admin'), (req, res) => {
  const body = cleanBody(req.body, ['verrouille', 'palette', 'polices', 'motif']);
  try {
    const item = updateCharte(getDb(), req.user, body);
    audit(req, 'SYNTHESE_CHARTE_MODIFICATION', { entite: 'synthese_charte', details: { ...body, verrouille: item.verrouille } });
    res.json({ item });
  } catch (error) {
    throw badRequest(error.message);
  }
});

router.post('/numero', requireWrite, (req, res) => {
  const body = cleanBody(req.body, ['annee', 'motif']);
  try {
    res.json({ item: nextNumero(getDb(), body.annee, body.motif) });
  } catch (error) {
    throw badRequest(error.message);
  }
});

router.get('/sources', requireAuth, (_req, res) => {
  res.json({ items: listSources(getDb()) });
});

router.post('/sources', requireRole('admin'), (req, res) => {
  try {
    const item = addSource(getDb(), req.user, req.body?.domaine);
    audit(req, 'SYNTHESE_SOURCE_AJOUT', { entite: 'synthese_source', details: { domaine: item.domaine } });
    res.status(201).json({ item });
  } catch (error) {
    throw badRequest(error.message);
  }
});

router.delete('/sources/:id', requireRole('admin'), (req, res) => {
  const items = removeSource(getDb(), req.params.id);
  audit(req, 'SYNTHESE_SOURCE_RETRAIT', { entite: 'synthese_source', entiteId: req.params.id });
  res.json({ items });
});

router.get('/catalogue', requireAuth, (_req, res) => {
  res.json(cataloguePayload());
});

router.post('/requete', requireAuth, (req, res) => {
  const item = normaliserRequete(req.body, { allowDeleted: req.user.role === 'admin' });
  res.json({ item });
});

router.post('/evaluer', requireAuth, (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const unknown = Object.keys(body).filter((key) => key !== 'requetes');
  if (unknown.length) throw badRequest('Champ inconnu', { [unknown[0]]: 'Champ inconnu' });
  const items = evaluerRequetes(getDb(), body.requetes, { allowDeleted: req.user.role === 'admin' });
  res.json({ items });
});

router.get('/modeles', requireAuth, (req, res) => {
  res.json({ items: listModeles(getDb(), req.user) });
});

router.get('/modeles/:id', requireAuth, (req, res) => {
  res.json({ item: getModele(getDb(), req.params.id, req.user) });
});

router.post('/modeles', requireWrite, (req, res) => {
  const item = createModele(getDb(), req.user, modelePayload(req));
  audit(req, 'SYNTHESE_MODELE_CREATION', { entite: 'synthese_modele', entiteId: item.id, details: { nom: item.nom } });
  res.status(201).json({ item });
});

router.put('/modeles/:id', requireWrite, (req, res) => {
  const item = updateModele(getDb(), req.user, req.params.id, modelePayload(req));
  audit(req, 'SYNTHESE_MODELE_MODIFICATION', { entite: 'synthese_modele', entiteId: item.id, details: { version: item.version } });
  res.json({ item });
});

router.delete('/modeles/:id', requireWrite, (req, res) => {
  archiveModele(getDb(), req.user, req.params.id);
  audit(req, 'SYNTHESE_MODELE_SUPPRESSION', { entite: 'synthese_modele', entiteId: req.params.id });
  res.status(204).end();
});

router.post('/modeles/:id/dupliquer', requireWrite, (req, res) => {
  const result = duplicateModele(getDb(), req.user, req.params.id, duplicationPayload(req));
  audit(req, 'SYNTHESE_MODELE_DUPLICATION', {
    entite: 'synthese_modele',
    entiteId: result.item.id,
    details: { source_id: result.source, nom: result.item.nom },
  });
  res.status(201).json({ item: result.item });
});

router.post('/modeles/:id/personnaliser', requireWrite, (req, res) => {
  const result = personnaliserModele(getDb(), req.user, req.params.id);
  audit(req, 'SYNTHESE_MODELE_PERSONNALISATION', {
    entite: 'synthese_modele',
    entiteId: result.item.id,
    details: { source_id: result.source, cree: result.created },
  });
  res.status(result.created ? 201 : 200).json({ item: result.item, created: result.created, source: result.source });
});

router.post('/modeles/:id/reinitialiser', requireWrite, (req, res) => {
  const body = cleanBody(req.body, ['source_id']);
  const result = reinitialiserModele(getDb(), req.user, req.params.id, body.source_id ?? null);
  audit(req, 'SYNTHESE_MODELE_REINITIALISATION', {
    entite: 'synthese_modele',
    entiteId: result.item.id,
    details: { source_id: result.source, version: result.item.version },
  });
  res.json({ item: result.item, source: result.source });
});

router.get('/editions', requireAuth, (req, res) => {
  const modeleId = req.query.modele_id ? Number(req.query.modele_id) : null;
  res.json({ items: listEditions(getDb(), req.user, { modeleId }) });
});

router.post('/editions', requireWrite, (req, res) => {
  const body = cleanBody(req.body, ['modele_id', 'periode', 'filtres']);
  const item = createEdition(getDb(), req.user, body);
  audit(req, 'SYNTHESE_EDITION_CREATION', {
    entite: 'synthese_edition',
    entiteId: item.id,
    details: { modele_id: item.modele_id, periode: item.periode, version: item.version },
  });
  res.status(201).json({ item });
});

router.get('/editions/:id', requireAuth, (req, res) => {
  res.json({ item: getEdition(getDb(), req.user, req.params.id) });
});

router.post('/editions/:id/figer', requireWrite, (req, res) => {
  const item = freezeEdition(getDb(), req.user, req.params.id);
  audit(req, 'SYNTHESE_FIGEE', {
    entite: 'synthese_edition',
    entiteId: item.id,
    details: { version: item.version, periode: item.periode },
  });
  res.json({ item });
});

router.get('/editions/:id/export.xlsx', requireAuth, asyncHandler(async (req, res) => {
  const edition = getEdition(getDb(), req.user, req.params.id);
  const buffer = await editionWorkbook(edition);
  const filename = `synthese-${edition.modele_id}-${edition.periode.debut}-v${edition.version}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
  audit(req, 'SYNTHESE_EDITION_EXPORT', {
    entite: 'synthese_edition',
    entiteId: edition.id,
    details: { format: 'xlsx', version: edition.version },
  });
}));

export default router;
