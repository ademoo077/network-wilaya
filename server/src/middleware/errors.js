import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function errorHandler(error, req, res, _next) {
  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
        ...(error.details ? { details: error.details } : {}),
      },
    });
  }
  if (error?.name === 'MulterError') {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: { code: 'UPLOAD', message: error.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux (5 Mo maximum)' : 'Téléversement invalide' } });
  }
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'JSON_INVALIDE', message: 'Corps de requête JSON invalide' } });
  }
  logger.error('Erreur non gérée', { path: req.originalUrl, method: req.method, message: error?.message, stack: error?.stack });
  return res.status(500).json({ error: { code: 'ERREUR_INTERNE', message: 'Une erreur interne est survenue' } });
}

export function notFoundApi(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ressource introuvable' } });
}
