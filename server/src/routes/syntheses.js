import { Router } from 'express';
import {
  syntheseModelePayloadSchema, validerDefinition, zodFields,
} from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAuth, requireWrite } from '../middleware/auth.js';
import { badRequest } from '../utils/errors.js';
import { audit } from '../services/audit.js';
import {
  archiveModele, cataloguePayload, createModele, duplicateModele, evaluerRequetes,
  getModele, listModeles, normaliserRequete, updateModele,
} from '../services/syntheses.js';

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

export default router;
