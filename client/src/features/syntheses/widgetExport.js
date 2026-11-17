import { formatValue } from '@anm/shared';
import { dimensionLabel, measureLabel, mesuresOf, rowsOf } from './widgetData.js';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export PNG autonome : le contenu du widget est dessiné depuis les résultats, sans HTML externe. */
export function downloadWidgetPng({ title, result, lang }) {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  const tokens = getComputedStyle(document.documentElement);
  const token = (name) => tokens.getPropertyValue(name).trim();
  ctx.fillStyle = token('--surface') || 'transparent';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = token('--ink');
  ctx.font = '700 24px Inter, sans-serif';
  ctx.fillText(title || '', 32, 48);

  const rows = rowsOf(result);
  const measures = mesuresOf(result);
  let y = 92;
  ctx.font = '16px Inter, sans-serif';
  for (const row of rows.slice(0, 12)) {
    const label = dimensionLabel(Object.keys(row).find((key) => key !== 'valeurs' && key !== 'comparaison') || '', lang) || row.name || '';
    const values = measures.map((measure) => `${measureLabel(measure.id, lang)} : ${formatValue(row.valeurs?.[measure.id], measure.format, lang)}`).join(' · ');
    ctx.fillText(`${label}${values ? ` — ${values}` : ''}`.slice(0, 110), 32, y);
    y += 34;
  }
  if (!rows.length) ctx.fillText(formatValue(null, 'entier', lang), 32, y);
  canvas.toBlob((blob) => { if (blob) download(blob, `${title || 'widget'}.png`); }, 'image/png');
}
