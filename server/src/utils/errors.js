export class AppError extends Error {
  constructor(status, code, message, fields = null, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.details = details;
  }
}

export const badRequest = (message, fields) => new AppError(400, 'VALIDATION', message, fields);
export const unauthorized = (message = 'Authentification requise') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Action non autorisée') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Élément introuvable') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (code, message, details) => new AppError(409, code, message, null, details);
export const business = (message, code = 'REGLE_METIER', fields) => new AppError(422, code, message, fields);
export const tooLarge = (message = 'Fichier trop volumineux') => new AppError(413, 'TROP_VOLUMINEUX', message);
export const tooMany = (message = 'Trop de tentatives, réessayez plus tard') => new AppError(429, 'TROP_DE_REQUETES', message);

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
