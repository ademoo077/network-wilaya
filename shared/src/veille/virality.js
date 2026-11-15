export function viraliteScore(metrics = {}) {
  return Number(metrics.reactions || 0) + 2 * Number(metrics.commentaires || metrics.comments || 0)
    + 3 * Number(metrics.partages || metrics.shares || 0);
}

export function percentileRank(value, values = []) {
  const clean = values.map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!clean.length) return 0;
  const below = clean.filter((n) => n < Number(value)).length;
  const equal = clean.filter((n) => n === Number(value)).length;
  return (below + 0.5 * equal) / clean.length;
}

export function percentile(values = [], ratio = 0.9) {
  const clean = values.map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!clean.length) return 0;
  const rank = Math.max(1, Math.ceil(ratio * clean.length));
  return clean[rank - 1];
}

export function isViral(value, values = [], ratio = 0.9) {
  if (!values.length) return false;
  return Number(value) >= percentile(values, ratio);
}
