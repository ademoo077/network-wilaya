import { CATALOGUE } from '@anm/shared';

export function rowsOf(result) { return result?.lignes || []; }
export function dimsOf(result) { return result?.colonnes?.dimensions || []; }
export function mesuresOf(result) { return result?.colonnes?.mesures || []; }

export function measureLabel(id, lang) {
  const mesure = CATALOGUE.mesures[id];
  if (!mesure) return id;
  return lang === 'ar' ? (mesure.label_ar || mesure.label_fr) : (mesure.label_fr || mesure.label_ar);
}

export function dimensionLabel(champ, lang) {
  const dimension = CATALOGUE.dimensions[String(champ).replace(/^t\./, '')];
  if (!dimension) return champ;
  return lang === 'ar' ? (dimension.label_ar || dimension.label_fr) : (dimension.label_fr || dimension.label_ar);
}

export function rowDimensionLabel(row, dimension, index, lang) {
  const values = row?.dimensions || [];
  const value = values.find((entry) => entry.id === dimension.id || entry.id === dimension.champ) || values[index];
  if (!value) return '—';
  return lang === 'ar'
    ? (value.label_ar || value.label_fr || value.key || '—')
    : (value.label_fr || value.label_ar || value.key || '—');
}

export function chartData(result, lang) {
  const dimensions = dimsOf(result);
  const mesures = mesuresOf(result);
  return rowsOf(result).map((row) => {
    const name = dimensions.length
      ? dimensions.map((dimension, index) => rowDimensionLabel(row, dimension, index, lang)).join(' · ')
      : mesures.map((mesure) => measureLabel(mesure.id, lang)).join(' · ');
    const values = Object.fromEntries(mesures.map((mesure) => [mesure.id, Number(row.valeurs?.[mesure.id] || 0)]));
    return { name, ...values };
  });
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function downloadWidgetCsv(result, title, lang) {
  const dimensions = dimsOf(result);
  const mesures = mesuresOf(result);
  const headers = dimensions.map((dimension) => dimensionLabel(dimension.champ, lang))
    .concat(mesures.map((mesure) => measureLabel(mesure.id, lang)));
  const rows = rowsOf(result).map((row) => [
    ...dimensions.map((dimension, index) => rowDimensionLabel(row, dimension, index, lang)),
    ...mesures.map((mesure) => row.valeurs?.[mesure.id] ?? ''),
  ]);
  if (result?.totaux) rows.push([
    ...dimensions.map(() => lang === 'ar' ? 'المجموع' : 'Total'),
    ...mesures.map((mesure) => result.totaux.valeurs?.[mesure.id] ?? ''),
  ]);
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${String(title || 'widget').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'widget'}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
