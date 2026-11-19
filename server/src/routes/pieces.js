import { Router } from 'express';
import { z } from 'zod';
import { zodFields } from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAuth, requireWrite } from '../middleware/auth.js';
import { deletePiece, getPiece, getPieceThumb, listPhotoPairs, updatePiece } from '../services/attachments.js';
import { badRequest } from '../utils/errors.js';

const router = Router();

const photoPairsQuerySchema = z.object({
  debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limite: z.coerce.number().int().min(1).max(24).optional(),
}).strict();

router.get('/paires', requireAuth, (req, res, next) => {
  const parsed = photoPairsQuerySchema.safeParse(req.query || {});
  if (!parsed.success) return next(badRequest('Période ou limite invalide', zodFields(parsed.error)));
  const { debut = '0000-01-01', fin = '9999-12-31', limite = 12 } = parsed.data;
  if (debut > fin) return next(badRequest('La date de début doit précéder la date de fin', { debut: 'Période invalide' }));
  return res.json({ items: listPhotoPairs(getDb(), { debut, fin, limite }) });
});

function sendPiece(req, res, next, kind) {
  const piece = kind === 'thumb' ? getPieceThumb(getDb(), Number(req.params.id)) : getPiece(getDb(), Number(req.params.id));
  if (!piece) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pièce jointe introuvable' } });
  res.type(kind === 'thumb' ? 'image/jpeg' : piece.mime);
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(piece.nom_original || 'piece')}"`);
  return res.sendFile(piece.absolute, (error) => { if (error) next(error); });
}

router.get('/:id/file', requireAuth, (req, res, next) => sendPiece(req, res, next, 'file'));
router.get('/:id/thumb', requireAuth, (req, res, next) => sendPiece(req, res, next, 'thumb'));

router.patch('/:id', requireWrite, (req, res) => {
  const item = updatePiece(getDb(), Number(req.params.id), req.body || {});
  if (!item) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pièce jointe introuvable' } });
  return res.json({ item });
});

router.delete('/:id', requireWrite, (req, res) => {
  const result = deletePiece(getDb(), Number(req.params.id));
  if (!result) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pièce jointe introuvable' } });
  return res.json({ ok: true });
});

export default router;
