import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { VERSION } from '@anm/shared';
import { config } from './config/index.js';
import { getDb } from './db/index.js';
import { getParams } from './services/settings.js';
import { securityHeaders } from './middleware/security.js';
import { attachUser } from './middleware/auth.js';
import { csrfProtection } from './middleware/csrf.js';
import { maintenanceMode } from './middleware/maintenance.js';
import { errorHandler, notFoundApi } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import refRoutes from './routes/ref.js';
import usersRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';
import anomaliesRoutes from './routes/anomalies.js';
import piecesRoutes from './routes/pieces.js';
import statsRoutes from './routes/stats.js';
import reportsRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import toolsRoutes from './routes/tools.js';
import geoRoutes from './routes/geo.js';
import errorsRoutes from './routes/errors.js';
import adminLimitsRoutes from './routes/adminLimits.js';
import viewsRoutes from './routes/views.js';
import workRoutes from './routes/work.js';
import { setupStatus } from './services/refs.js';

const distDir = config.clientDist;

function apiRateLimit() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: config.env === 'test' ? 100000 : 600,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({
      error: { code: 'TROP_DE_REQUETES', message: 'Trop de requêtes — réessayez dans une minute' },
    }),
  });
}

function health(_req, res) {
  let dbOk = false;
  try {
    dbOk = getDb().prepare('SELECT 1 AS ok').get()?.ok === 1;
  } catch {
    dbOk = false;
  }
  const payload = { ok: dbOk, version: VERSION, db: dbOk, at: new Date().toISOString() };
  return res.status(dbOk ? 200 : 503).json(payload);
}

function configPayload() {
  const params = getParams(getDb());
  return {
    version: VERSION,
    nom_cellule: params.nom_cellule,
    tile_url: params.tile_url,
    week_start_day: Number(params.week_start_day) || 0,
    gps_bbox: params.gps_bbox,
  };
}

function mountStatic(app) {
  if (!fs.existsSync(distDir)) return;
  app.use(express.static(distDir, {
    index: false,
    etag: true,
    lastModified: false,
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    return res.sendFile(path.join(distDir, 'index.html'));
  });
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(maintenanceMode);
  app.use(securityHeaders());
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.use(cookieParser());

  app.get('/api/health', health);
  app.get('/api/config', (_req, res) => res.json(configPayload()));

  app.use('/api', apiRateLimit());
  app.use('/api', attachUser);
  app.use('/api', csrfProtection);

  app.use('/api/auth', authRoutes);
  app.use('/api/ref', refRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/anomalies', anomaliesRoutes);
  app.use('/api/pieces', piecesRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/tools', toolsRoutes);
  app.use('/api/geo', geoRoutes);
  app.use('/api', errorsRoutes);
  app.use('/api/admin/limites', adminLimitsRoutes);
  app.use('/api/views', viewsRoutes);
  app.use('/api/work', workRoutes);
  app.use('/api/admin', adminRoutes);
  app.get('/api/setup/status', (_req, res) => res.json(setupStatus(getDb())));

  app.use('/api', notFoundApi);
  mountStatic(app);
  app.use(errorHandler);
  return app;
}
