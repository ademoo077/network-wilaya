/** V19 — charte institutionnelle du Cabinet du Wali. */
import { CHARTE_V19, PALETTES, normaliserCouleur } from '@anm/shared';

function parseJson(value, fallback) {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; }
}

export function getCharte(db) {
  const row = db.prepare('SELECT * FROM synthese_charte WHERE id = 1').get();
  if (!row) return { verrouille: true, palette: [...CHARTE_V19.palette], polices: [...CHARTE_V19.polices], motif: CHARTE_V19.motifReference };
  return {
    verrouille: Boolean(row.verrouille),
    palette: parseJson(row.palette_json, [...CHARTE_V19.palette]),
    polices: parseJson(row.polices_json, [...CHARTE_V19.polices]),
    motif: row.motif,
    updatedBy: row.updated_by ?? null,
    updatedAt: row.updated_at,
  };
}

export function updateCharte(db, user, body = {}) {
  const current = getCharte(db);
  const next = { ...current };
  if (body.verrouille !== undefined) next.verrouille = Boolean(body.verrouille);
  if (body.palette !== undefined) {
    if (!Array.isArray(body.palette) || body.palette.length > 5 || body.palette.length === 0) throw new Error('Palette invalide (1 à 5 couleurs)');
    next.palette = body.palette.map(normaliserCouleur);
    if (next.palette.some((color) => !color)) throw new Error('Couleur invalide');
  }
  if (body.polices !== undefined) {
    if (!Array.isArray(body.polices) || !body.polices.length || body.polices.some((p) => typeof p !== 'string' || p.length > 40)) throw new Error('Polices invalides');
    next.polices = body.polices;
  }
  if (body.motif !== undefined) {
    if (typeof body.motif !== 'string' || !body.motif.includes('{SEQ}') || !body.motif.includes('{AAAA}') || body.motif.length > 80) throw new Error('Motif de numérotation invalide');
    next.motif = body.motif;
  }
  db.prepare(`UPDATE synthese_charte SET verrouille = ?, palette_json = ?, polices_json = ?, motif = ?,
    updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 1`)
    .run(next.verrouille ? 1 : 0, JSON.stringify(next.palette), JSON.stringify(next.polices), next.motif, user?.id ?? null);
  return getCharte(db);
}

export function couleurAutorisee(charte, color) {
  if (!charte?.verrouille) return true;
  const normalisee = normaliserCouleur(color);
  if (!normalisee) return false;
  return charte.palette.some((candidate) => normaliserCouleur(candidate) === normalisee)
    || PALETTES.institutionnel.includes(normalisee);
}
