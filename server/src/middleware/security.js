import helmet from 'helmet';
import { config } from '../config/index.js';
import { getDb } from '../db/index.js';
import { getParams } from '../services/settings.js';

function tileOrigins() {
  try {
    const params = getParams(getDb());
    const template = String(params.tile_url || 'https://tile.openstreetmap.de/{z}/{x}/{y}.png');
    const sample = template
      .replace('{s}', 'a')
      .replace('{z}', '0')
      .replace('{x}', '0')
      .replace('{y}', '0')
      .replace('{r}', '');
    const { origin, hostname } = new URL(sample);
    if (template.includes('{s}')) {
      const parts = hostname.split('.');
      const base = parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
      return [`https://*.${base}`, origin];
    }
    return [origin];
  } catch {
    return ['https://tile.openstreetmap.de'];
  }
}

export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', ...tileOrigins()],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
    hsts: config.https ? undefined : false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'same-origin' },
  });
}
