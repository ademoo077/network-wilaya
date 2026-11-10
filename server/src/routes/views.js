import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth, requireWrite } from '../middleware/auth.js';
import { audit } from '../services/audit.js';
import {
  listSavedViews, createSavedView, updateSavedView, deleteSavedView,
} from '../services/savedViews.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  res.json({ items: listSavedViews(getDb(), req.user) });
});

router.post('/', requireWrite, (req, res) => {
  const item = createSavedView(getDb(), req.user, req.body || {});
  audit(req, 'VUE_SAVE', { entite: 'vues', entiteId: item.id, details: { nom: item.nom } });
  res.status(201).json({ item });
});

router.patch('/:id', requireWrite, (req, res) => {
  res.json({ item: updateSavedView(getDb(), req.user, req.params.id, req.body || {}) });
});

router.delete('/:id', requireWrite, (req, res) => {
  deleteSavedView(getDb(), req.user, req.params.id);
  audit(req, 'VUE_DELETE', { entite: 'vues', entiteId: req.params.id });
  res.json({ ok: true });
});

export default router;
