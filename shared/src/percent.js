/** Arrondi à 1 décimale par la méthode du plus grand reste. */
export function splitPercent(counts) {
  const list = counts.map((n) => (Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : 0));
  const total = list.reduce((a, b) => a + b, 0);
  if (!total) return list.map(() => null);
  const exact = list.map((n) => (n * 1000) / total);
  const base = exact.map((n) => Math.floor(n));
  let rest = 1000 - base.reduce((a, b) => a + b, 0);
  const order = exact
    .map((n, i) => ({ i, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  let k = 0;
  while (rest > 0 && order.length) {
    base[order[k % order.length].i] += 1;
    k += 1;
    rest -= 1;
  }
  return base.map((n) => n / 10);
}

/** Pourcentage simple à 1 décimale, null si total = 0. */
export function percent(part, total) {
  if (!total) return null;
  return Math.round((part * 1000) / total) / 10;
}

export function variation(current, previous, kind = 'percent') {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  if (kind === 'points') return Math.round((current - previous) * 1000) / 10;
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
