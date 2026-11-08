import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth, requireWrite } from '../middleware/auth.js';
import { deletePiece, getPiece } from '../services/attachments.js';

const router = Router();

router.get('/:id/file', requireAuth, (req, res, next) => {
  const piece = getPiece(getDb(), Number(req.params.id));
  if (!piece) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pièce jointe introuvable' } });
  res.type(piece.mime);
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(piece.nom_original || 'piece')}"`);
  return res.sendFile(piece.absolute, (error) => { if (error) next(error); });
});

router.delete('/:id', requireWrite, (req, res) => {
  const result = deletePiece(getDb(), Number(req.params.id));
  if (!result) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pièce jointe introuvable' } });
  return res.json({ ok: true });
});

export default router;
