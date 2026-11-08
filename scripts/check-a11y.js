import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokensPath = path.join(root, 'client', 'src', 'styles', 'tokens.css');

function parseBlock(css, selector) {
  const escaped = selector.replace(/[[\]"]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm');
  const match = css.match(re);
  if (!match) return {};
  const vars = {};
  for (const line of match[1].split(';')) {
    const m = line.match(/--([\w-]+)\s*:\s*([^;]+)/);
    if (m) vars[m[1]] = m[2].trim();
  }
  return vars;
}

function hexToRgb(hex) {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function luminance([r, g, b]) {
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function contrast(fg, bg) {
  const a = hexToRgb(fg);
  const b = hexToRgb(bg);
  if (!a || !b) return null;
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const PAIRS = [
  ['ink', 'bg'], ['ink', 'surface'], ['ink', 'surface-2'],
  ['ink-2', 'bg'], ['ink-2', 'surface'], ['muted', 'surface'],
  ['brand-50', 'brand-800'], ['brand-50', 'brand-900'],
  ['st-non', 'st-non-bg'], ['st-cours', 'st-cours-bg'], ['st-traite', 'st-traite-bg'],
  ['danger', 'surface'], ['warning', 'surface'], ['info', 'surface'],
];

const css = fs.readFileSync(tokensPath, 'utf8');
const light = { ...parseBlock(css, ':root'), white: '#ffffff' };
const dark = { ...light, ...parseBlock(css, '[data-theme="dark"]') };

let failed = false;
for (const [theme, vars] of [['clair', light], ['sombre', dark]]) {
  for (const [fgName, bgName] of PAIRS) {
    if (!vars[fgName] || !vars[bgName]) {
      console.error(`${theme}: variable manquante --${vars[fgName] ? bgName : fgName}`);
      failed = true;
      continue;
    }
    const value = contrast(vars[fgName], vars[bgName]);
    const ok = value !== null && value >= 4.5;
    console.log(`${theme} --${fgName} sur --${bgName} : ${value === null ? 'inconnu' : value.toFixed(2)} ${ok ? 'OK' : 'ÉCHEC'}`);
    if (!ok) failed = true;
  }
}

if (failed) {
  console.error('\ncheck:a11y ÉCHEC — contraste AA (< 4,5) ou variable absente.');
  process.exit(1);
}
console.log('\ncheck:a11y OK (contraste des tokens, clair et sombre)');
