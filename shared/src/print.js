export const PRINT_FORMATS = {
  a5: { id: 'a5', label: 'A5', w: 148, h: 210, margin: 8, min: 6 },
  a4: { id: 'a4', label: 'A4', w: 210, h: 297, margin: 10, min: 7 },
  a3: { id: 'a3', label: 'A3', w: 297, h: 420, margin: 12, min: 8 },
  letter: { id: 'letter', label: 'Lettre', w: 215.9, h: 279.4, margin: 10, min: 7 },
};

export function formatDims(format = 'a4', orientation = 'portrait', custom = {}) {
  const base = PRINT_FORMATS[format] || { w: Number(custom.w) || 210, h: Number(custom.h) || 297, margin: 8, min: 6, id: 'custom' };
  const w = format === 'custom' ? Math.max(100, Number(custom.w) || 210) : base.w;
  const h = format === 'custom' ? Math.max(100, Number(custom.h) || 297) : base.h;
  const portrait = orientation !== 'landscape';
  return { ...base, w: portrait ? w : h, h: portrait ? h : w, rawW: w, rawH: h };
}

export function normalizeMargins(m = {}, format = 'a4') {
  const def = PRINT_FORMATS[format]?.margin ?? 8;
  const min = PRINT_FORMATS[format]?.min ?? 6;
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  return {
    top: num(m.top, def), right: num(m.right, def), bottom: num(m.bottom, def), left: num(m.left, def),
    gutter: num(m.gutter, 0), min,
  };
}

export function utileZone(format = 'a4', orientation = 'portrait', margins = {}, custom = {}) {
  const d = formatDims(format, orientation, custom);
  const m = normalizeMargins(margins, format);
  const left = m.left + m.gutter;
  return {
    width: Math.max(40, d.w - left - m.right),
    height: Math.max(40, d.h - m.top - m.bottom),
    pageWidth: d.w, pageHeight: d.h, margins: { ...m, left },
  };
}

export function echelleTypo(largeurUtileMm) {
  return Math.max(0.75, Math.min(1.15, largeurUtileMm / 190));
}

export function colonnesCible(largeurUtileMm) {
  return largeurUtileMm < 140 ? 6 : 12;
}

export function adapterBlocA5(bloc, largeurUtileMm) {
  const cols = colonnesCible(largeurUtileMm);
  if (cols === 12) return { ...bloc };
  const w = Number(bloc?.options?.largeur_cellules || bloc?.w || 12);
  const map = (v) => (v <= 3 ? 6 : v <= 4 ? 6 : v <= 6 ? 6 : 12);
  const next = { ...bloc, options: { ...(bloc?.options || {}), largeur_cellules: map(w) } };
  return next;
}

function clone(x) { return JSON.parse(JSON.stringify(x)); }

export function paginer(blocs, { hauteurUtile = 260, mesure = null } = {}) {
  const items = (blocs || []).map((b, i) => ({ ...clone(b), __i: i }));
  const h = (b) => {
    const m = mesure?.(b);
    if (Number.isFinite(m) && m > 0) return m;
    const hh = Number(b?.h || b?.hauteur || b?.options?.hauteur_cellules || 4);
    return Math.max(8, hh * 10);
  };
  const pages = [];
  let current = { index: 0, blocs: [], hauteur: 0 };
  const pushPage = () => { if (current.blocs.length) pages.push(current); current = { index: pages.length, blocs: [], hauteur: 0 }; };
  for (const b of items) {
    const bh = h(b);
    const gap = current.blocs.length ? 4 : 0;
    if (b.saut_page && current.blocs.length) pushPage();
    if (current.blocs.length && current.hauteur + gap + bh > hauteurUtile && bh <= hauteurUtile) pushPage();
    const g = current.blocs.length ? 4 : 0;
    current.blocs.push(b);
    current.hauteur += g + bh;
  }
  if (current.blocs.length || pages.length === 0) pages.push(current);
  return pages.map((p, i) => ({ ...p, index: i + 1 }));
}

export function equilibrer(pages, { hauteurUtile = 260, dernier = false } = {}) {
  const out = clone(pages || []);
  for (let i = 0; i < out.length; i++) {
    const page = out[i];
    const isLast = i === out.length - 1;
    if (isLast && !dernier) continue;
    const blocs = page.blocs || [];
    const hauteurs = blocs.map((b) => Math.max(8, Number(b.hauteur_mm || b.hauteur || (Number(b?.options?.hauteur_cellules || 4) * 10))));
    let reste = hauteurUtile - hauteurs.reduce((s, v) => s + v, 0) - Math.max(0, blocs.length - 1) * 4;
    if (reste <= 0) { page.reste = 0; continue; }
    // 1. étirer blocs étirables (graphiques/cartes/images) jusqu'à +25%
    for (let j = 0; j < blocs.length && reste > 0.5; j++) {
      const b = blocs[j];
      const type = b.type || '';
      const etirable = /carte|image|graphique|barres|courbe|anneau|histogramme|pareto|aire|radar|nuage|treemap|entonnoir|heatmap|carte_thermique/.test(type);
      if (!etirable) continue;
      const maxAdd = hauteurs[j] * 0.25;
      const add = Math.min(reste, maxAdd);
      hauteurs[j] += add; b.hauteur_mm = hauteurs[j]; reste -= add;
    }
    // 2. élargir espacements jusqu'à x2 (plafond 12mm)
    if (reste > 0.5 && blocs.length > 1) {
      const gaps = blocs.length - 1;
      const extra = Math.min(reste / gaps, 8); // 4mm base -> max 12mm
      page.gap_mm = 4 + extra;
      reste -= extra * gaps;
    } else {
      page.gap_mm = 4;
    }
    // 3. remonter première ligne de la page suivante si déplacable et tient
    if (reste > 20 && i < out.length - 1) {
      const next = out[i + 1];
      const first = next.blocs?.[0];
      const fh = Math.max(8, Number(first?.hauteur_mm || (Number(first?.options?.hauteur_cellules || 4) * 10)));
      if (first && first.deplacable !== false && !/tableau|liste/.test(first.type || '') && fh + 4 <= reste) {
        page.blocs.push(next.blocs.shift());
        page.hauteur_mm = hauteurUtile - (reste - fh - 4);
      }
    }
    page.reste = Math.max(0, reste);
  }
  return out.filter((p) => (p.blocs || []).length > 0);
}

export function tauxRemplissage(pages, hauteurUtile = 260) {
  const list = (pages || []).filter((_, i, a) => i < a.length - 1 || a.length === 1);
  if (!list.length) return 100;
  const vals = list.map((p) => {
    const hs = (p.blocs || []).map((b) => Math.max(8, Number(b.hauteur_mm || (Number(b?.options?.hauteur_cellules || 4) * 10))));
    const used = hs.reduce((s, v) => s + v, 0) + Math.max(0, hs.length - 1) * Number(p.gap_mm || 4);
    return Math.max(0, Math.min(100, (used / hauteurUtile) * 100));
  });
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}
