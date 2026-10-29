function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}
function luminance([r, g, b]) {
  const a = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function contrast(fg, bg) {
  const l1 = luminance(hexToRgb(fg)); const l2 = luminance(hexToRgb(bg));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const pairs = [
  ['#0d1b16', '#f3f6f5'], ['#3d4f47', '#f3f6f5'], ['#6b7d75', '#f3f6f5'],
  ['#ffffff', '#0e8a5a'], ['#0d1b16', '#ffffff'], ['#3d4f47', '#ffffff'],
  ['#dc2626', '#fee2e2'], ['#d97706', '#fef3c7'], ['#059669', '#d1fae5'],
  ['#e8f3ee', '#08110e'], ['#b4c7be', '#08110e'], ['#82988e', '#08110e'],
];

let failed = false;
for (const [fg, bg] of pairs) {
  const c = contrast(fg, bg);
  const ok = c >= 4.5;
  console.log(`${fg} on ${bg}: ${c.toFixed(2)} ${ok ? 'OK' : 'FAIL'}`);
  if (!ok) failed = true;
}
if (failed) { console.error('check:a11y FAILED'); process.exit(1); }
console.log('check:a11y OK');