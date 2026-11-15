/* CORS strict pour l'extension de capture assistée.
   Seules les origines d'extension (chrome-extension://, moz-extension://) sont
   autorisées, uniquement sur POST /api/veille/capture. L'authentification reste
   assurée par le jeton Bearer (aucun cookie, donc aucun CSRF possible). */
const EXTENSION_ORIGIN = /^(chrome|moz)-extension:\/\/[a-z0-9-]+$/i;

export function extensionCors(req, res, next) {
  const origin = String(req.get('origin') || '');
  if (!EXTENSION_ORIGIN.test(origin)) {
    if (req.method === 'OPTIONS') {
      return res.status(403).json({
        error: { code: 'ORIGINE_REFUSEE', message: 'Origine non autorisée pour la capture assistée' },
      });
    }
    return next();
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
}
