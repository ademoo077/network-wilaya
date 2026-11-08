import helmet from 'helmet';
import { config } from '../config/index.js';
import { getDb } from '../db/index.js';
import { getParams } from '../services/settings.js';

function tileOrigin() {
  try {
    const params = getParams(getDb());
    return new URL(params.tile_url.replace('{z}', '0').replace('{x}', '0').replace('{y}', '0')).origin;
  } catch {
    return 'https://tile.openstreetmap.org';
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
        imgSrc: ["'self'", 'data:', 'blob:', tileOrigin()],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
    hsts: config.cookieSecure ? undefined : false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'same-origin' },
  });
}
