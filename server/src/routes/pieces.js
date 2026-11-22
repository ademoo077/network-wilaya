import { Router } from 'express';
import { z } from 'zod';
import { zodFields } from '@anm/shared';
import { getDb } from '../db/index.js';
import { requireAuth, requireWrite } from '../middleware/auth.js';
import { deletePiece, getPiece, getPieceThumb, listPhotoPairs, updatePiece } from '../services/attachments.js';
import { buildPhotoSheet } from '../services/photoSheetPdf.js';
import { cheminDerive, VARIANTES } from '../services/photoPipeline.js';
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

const plancheQuerySchema = photoPairsQuerySchema.extend({
  par_page: z.coerce.number().int().refine((value) => value === 2 || value === 4).optional(),
  lang: z.enum(['fr', 'ar']).optional(),
});

router.get('/planche.pdf', requireAuth, async (req, res, next) => {
  const parsed = plancheQuerySchema.safeParse(req.query || {});
  if (!parsed.success) return next(badRequest('Paramètres de planche invalides', zodFields(parsed.error)));
  const { debut = '0000-01-01', fin = '9999-12-31', limite = 12, par_page = 2, lang = 'fr' } = parsed.data;
  if (debut > fin) return next(badRequest('La date de début doit précéder la date de fin', { debut: 'Période invalide' }));
  try {
    const planche = await buildPhotoSheet(getDb(), { debut, fin, limite, parPage: par_page, lang });
    res.type('application/pdf');
    res.set('Content-Disposition', `attachment; filename="${planche.filename}"`);
    return res.send(planche.buffer);
  } catch (error) { return next(error); }
});

function sendPiece(req, res, next, kind) {
  const piece = kind === 'thumb' ? getPieceThumb(getDb(), Number(req.params.id)) : getPiece(getDb(), Number(req.params.id));
  if (!piece) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pièce jointe introuvable' } });
  const version = typeof req.query.v === 'string' ? req.query.v : null;
  if (version && piece.hash && version !== piece.hash.slice(0, 16)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Version d’image introuvable' } });
  }
  const taille = kind === 'thumb' ? null : (typeof req.query.taille === 'string' ? req.query.taille : null);
  if (taille && !VARIANTES.includes(taille)) {
    return next(badRequest('Taille d’image invalide', { taille: 'mini, moyen ou grand uniquement' }));
  }
  let absolute = piece.absolute;
  let mime = piece.mime;
  // La vignette est un JPEG uniquement quand un vrai dérivé est servi.
  // En repli sur l'original (pièce historique), on garde son MIME réel.
  if (kind === 'thumb' && piece.miniature_chemin && !taille) mime = 'image/jpeg';
  if (taille) {
    absolute = cheminDerive(piece, taille, 'webp') || cheminDerive(piece, taille, 'jpg');
    mime = absolute?.endsWith('.jpg') ? 'image/jpeg' : 'image/webp';
  }
  if (!absolute) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Dérivé introuvable' } });
  const etag = `"${piece.hash || `p${piece.id}`}-${kind}${taille ? `-${taille}` : ''}"`;
  res.set('ETag', etag);
  res.set('Cache-Control', 'private, max-age=86400, immutable');
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.type(mime);
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(piece.nom_original || 'piece')}"`);
  return res.sendFile(absolute, { etag: false, lastModified: false }, (error) => { if (error) next(error); });
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
