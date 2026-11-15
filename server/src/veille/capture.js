import { veilleCaptureSchema, zodFields } from '@anm/shared';
import { getDb } from '../db/index.js';
import { badRequest, tooLarge, tooMany } from '../utils/errors.js';
import { audit } from '../services/audit.js';
import { veilleContext } from './context.js';
import { createVeilleElement } from './ingest.js';
import { authenticateCaptureToken } from './tokens.js';

const buckets = new Map();
const LIMIT = 60;
const WINDOW_MS = 60 * 60 * 1000;

function hit(key, now = Date.now()) {
  const bucket = buckets.get(key) || { count: 0, reset: now + WINDOW_MS };
  if (now >= bucket.reset) { bucket.count = 0; bucket.reset = now + WINDOW_MS; }
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count <= LIMIT;
}

export function resetCaptureRateLimit() { buckets.clear(); }

function ensureCaptureSource(db) {
  let source = db.prepare(`SELECT id FROM veille_sources WHERE type = 'capture_assistee' ORDER BY id LIMIT 1`).get();
  if (source) return source.id;
  return Number(db.prepare(`INSERT INTO veille_sources(type, nom, actif, frequence_min)
    VALUES ('capture_assistee', 'Capture assistée', 1, 60)`).run().lastInsertRowid);
}

export function handleCapture(req, res) {
  const db = getDb();
  const auth = authenticateCaptureToken(db, req);
  if (!hit(auth.tokenId)) throw tooMany('Limite de capture atteinte pour ce jeton (60 éléments par heure)');
  const raw = JSON.stringify(req.body || {});
  if (Buffer.byteLength(raw, 'utf8') > 100 * 1024) throw tooLarge('La capture dépasse 100 Ko');
  const parsed = veilleCaptureSchema.safeParse(req.body || {});
  if (!parsed.success) throw badRequest('Capture invalide', zodFields(parsed.error));
  const sourceId = ensureCaptureSource(db);
  const context = veilleContext(db);
  const result = createVeilleElement(db, sourceId, { ...parsed.data, id_externe: parsed.data.url || undefined }, { context });
  audit({ ...req, user: auth.user }, 'VEILLE_CAPTURE', {
    entite: 'veille_elements', entiteId: result.element.id,
    details: { source_id: sourceId, token_id: auth.tokenId, created: result.created },
  });
  const analysis = result.analysis || null;
  res.status(result.created ? 201 : 200).json({
    item: result.element,
    created: result.created,
    suggestions: (analysis?.suggestions || []).map((suggestion) => ({
      groupe_id: suggestion.groupe_id, domaine_id: suggestion.domaine_id, type_id: suggestion.type_id,
      score: suggestion.score, confidence: suggestion.confidence, raisons: suggestion.raisons,
    })),
    statut: result.element.statut,
    priorite: result.element.priorite,
  });
}
