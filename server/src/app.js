import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config/index.js';
import authRoutes from './routes/authRoutes.js';
import anomaliesRoutes from './routes/anomaliesRoutes.js';
import referenceRoutes from './routes/referenceRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import reportsRoutes from './routes/reportsRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));
  app.use(cookieParser());
  app.use(
    session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' },
    }),
  );
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: true, legacyHeaders: false }));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));
  app.use('/api/auth', authRoutes);
  app.use('/api/anomalies', anomaliesRoutes);
  app.use('/api/references', referenceRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/reports', reportsRoutes);
  app.get('/api/health', (req, res) => res.json({ ok: true, service: 'wilaya-anomalies-api', at: new Date().toISOString() }));

  const distDir = path.resolve(process.cwd(), 'client/dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }

  app.use('/api', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ressource introuvable' } }));
  app.use(errorHandler);
  return app;
}
