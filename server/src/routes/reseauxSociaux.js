import { Router } from 'express';
import multer from 'multer';
import { compteSocialBatchSchema, compteSocialControlSchema, compteSocialCreateSchema, compteSocialMergeSchema, compteSocialUpdateSchema, reseauxSociauxQuerySchema, reseauxSociauxImportCancelRequestSchema, reseauxSociauxImportCommitSchema, zodFields } from '@anm/shared';
import { getDb } from '../db/index.js';
import { config } from '../config/index.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { asyncHandler, badRequest } from '../utils/errors.js';
import { audit } from '../services/audit.js';
import { createBackup } from '../services/backups.js';
import { controlerCompteSocial, createCompteSocial, createComptesSociauxLot, fusionnerComptesSociaux, getCompteSocial, historiqueCompteSocial, listComptesSociaux, mettreEnCorbeille, restaurerCompteSocial, updateCompteSocial } from '../services/reseauxSociaux.js';
import { statsReseauxSociaux } from '../services/statsReseauxSociaux.js';
import { exportReseauxSociaux } from '../services/exportReseauxSociaux.js';
import { cancelSocialImportPreview, commitSocialImportPreview, createSocialImportPreview, parseSocialWorkbook, readSocialImportPreview, suppliedSocialSource } from '../services/importReseauxSociaux.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const parse = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) throw badRequest('Données invalides', zodFields(result.error));
  return result.data;
};
router.use(requireAuth);
router.get('/', (req, res) => res.json(listComptesSociaux(getDb(), parse(reseauxSociauxQuerySchema, req.query))));
router.get('/stats', (req, res) => res.json({ item: statsReseauxSociaux(getDb(), parse(reseauxSociauxQuerySchema, req.query)) }));
router.get('/export', asyncHandler(async (req, res) => {
  const query = parse(reseauxSociauxQuerySchema, req.query);
  const result = await exportReseauxSociaux(getDb(), query, query.format || 'xlsx');
  audit(req, 'EXPORT', { entite: 'comptes_sociaux', details: { format: query.format || 'xlsx', lignes: result.count, filtres: query } });
  res.set('Content-Type', result.contentType).set('Content-Disposition', `attachment; filename="${result.filename}"`).send(result.buffer);
}));
router.post('/import/fourni', requireAdmin, (req, res) => {
  res.json({ item: createSocialImportPreview(getDb(), suppliedSocialSource(), req.user.id) });
});
router.post('/import/preview', requireAdmin, upload.single('file'), asyncHandler(async (req, res) => {
  const source = await parseSocialWorkbook(req.file);
  res.json({ item: createSocialImportPreview(getDb(), source, req.user.id) });
}));
router.post('/import/annuler', requireAdmin, (req, res) => {
  const data = parse(reseauxSociauxImportCancelRequestSchema, req.body);
  res.json({ item: cancelSocialImportPreview(data.importId, req.user.id) });
});
router.post('/import/commit', requireAdmin, asyncHandler(async (req, res) => {
  const data = parse(reseauxSociauxImportCommitSchema, req.body);
  const preview = readSocialImportPreview(data.importId, req.user.id);
  let backup = null;
  if (!preview.result) backup = await createBackup(getDb(), config.backupDir, 'securite');
  const result = commitSocialImportPreview(getDb(), data.importId, req.user.id);
  if (!result.deja_applique) {
    audit(req, 'RESEAUX_SOCIAUX_IMPORT', { entite: 'comptes_sociaux', details: { ...result.summary, created: result.created, sauvegarde: backup?.nom } });
    if (backup) audit(req, 'BACKUP_CREATE', { entite: 'sauvegardes', entiteId: backup.nom, details: { source: 'reseaux-sociaux:import' } });
  }
  res.json({ item: result });
}));
router.post('/', requireAdmin, (req, res) => {
  const item = createCompteSocial(getDb(), parse(compteSocialCreateSchema, req.body), req.user.id);
  audit(req, 'RESEAUX_SOCIAUX_CREATE', { entite: 'comptes_sociaux', entiteId: item.id, details: { nom: item.nom, plateforme: item.plateforme, categorie: item.categorie } });
  res.status(201).json({ item });
});
router.post('/lot', requireAdmin, (req, res) => {
  const data = parse(compteSocialBatchSchema, req.body);
  const item = createComptesSociauxLot(getDb(), data.elements, req.user.id);
  audit(req, 'RESEAUX_SOCIAUX_LOT', { entite: 'comptes_sociaux', details: { demandes: data.elements.length, créés: item.created, erreurs: item.errors.length } });
  res.status(201).json({ item });
});
router.post('/fusion', requireAdmin, (req, res) => {
  const data = parse(compteSocialMergeSchema, req.body);
  const item = fusionnerComptesSociaux(getDb(), data, req.user.id);
  audit(req, 'RESEAUX_SOCIAUX_FUSION', { entite: 'comptes_sociaux', entiteId: item.cibleId, details: { sourceId: item.sourceId, champs: item.champs } });
  res.json({ item });
});
router.get('/:id', (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) throw badRequest('Identifiant invalide');
  res.json({ item: getCompteSocial(getDb(), Number(req.params.id)) });
});
router.get('/:id/historique', (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) throw badRequest('Identifiant invalide');
  res.json(historiqueCompteSocial(getDb(), Number(req.params.id)));
});
router.patch('/:id', requireAdmin, (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) throw badRequest('Identifiant invalide');
  const data = parse(compteSocialUpdateSchema, req.body);
  const item = updateCompteSocial(getDb(), Number(req.params.id), data, req.user.id);
  audit(req, 'RESEAUX_SOCIAUX_UPDATE', { entite: 'comptes_sociaux', entiteId: item.id, details: { champs: Object.keys(data).filter((key) => key !== 'version'), version: item.version } });
  res.json({ item });
});
router.post('/:id/controle', requireAdmin, (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) throw badRequest('Identifiant invalide');
  const data = parse(compteSocialControlSchema, req.body);
  const item = controlerCompteSocial(getDb(), Number(req.params.id), data, req.user.id);
  audit(req, 'RESEAUX_SOCIAUX_CONTROLE', { entite: 'comptes_sociaux', entiteId: item.id, details: { verification: item.verification } });
  res.json({ item });
});
router.delete('/:id', requireAdmin, (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) throw badRequest('Identifiant invalide');
  const item = mettreEnCorbeille(getDb(), Number(req.params.id), req.user.id);
  audit(req, 'RESEAUX_SOCIAUX_CORBEILLE', { entite: 'comptes_sociaux', entiteId: item.id, details: { nom: item.nom } });
  res.json({ item });
});
router.post('/:id/restaurer', requireAdmin, (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) throw badRequest('Identifiant invalide');
  const item = restaurerCompteSocial(getDb(), Number(req.params.id), req.user.id);
  audit(req, 'RESEAUX_SOCIAUX_RESTAURATION', { entite: 'comptes_sociaux', entiteId: item.id, details: { nom: item.nom } });
  res.json({ item });
});
export default router;
