let maintenance = false;

export function setMaintenance(value) {
  maintenance = Boolean(value);
}

export function isMaintenance() {
  return maintenance;
}

export function maintenanceMode(req, res, next) {
  if (!maintenance) return next();
  if (req.path === '/api/health') return next();
  return res.status(503).json({ error: { code: 'MAINTENANCE', message: 'Maintenance en cours — réessayez dans quelques instants' } });
}
