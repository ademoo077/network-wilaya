export function errorHandler(err, req, res, next) {
  const status = err?.status || err?.statusCode || 500;
  const isDev = process.env.NODE_ENV !== 'production';
  const code = err?.code || 'INTERNAL_ERROR';
  const message = status >= 500 && !isDev ? 'Erreur interne' : err?.message || 'Erreur interne';
  if (status >= 500) {
    console.error('[errorHandler]', err);
  }
  if (res.headersSent) {
    return next(err);
  }
  res.status(status).json({ error: { code, message } });
}
