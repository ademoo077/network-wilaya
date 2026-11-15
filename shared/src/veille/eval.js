export function evaluateCases(cases, predict) {
  let tp = 0; let fp = 0; let fn = 0; let tn = 0;
  const matrix = new Map();
  const details = [];
  for (const item of cases) {
    const actual = item.groupe || null;
    const predicted = predict(item) || null;
    const cell = `${actual || 'aucun'} → ${predicted || 'aucun'}`;
    matrix.set(cell, (matrix.get(cell) || 0) + 1);
    if (actual && predicted && actual === predicted) tp += 1;
    else if (!actual && !predicted) tn += 1;
    else if (predicted && (!actual || actual !== predicted)) fp += 1;
    else fn += 1;
    details.push({ id: item.id, actual, predicted, ok: actual === predicted });
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return {
    total: cases.length, tp, fp, fn, tn,
    precision, recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    matrix: [...matrix.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([cell, count]) => ({ cell, count })),
    details,
  };
}
