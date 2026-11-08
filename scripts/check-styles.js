import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scanDir = path.join(root, 'client', 'src');
const FORBIDDEN = [
  { re: /\bbg-white\b/, label: 'bg-white' },
  { re: /\btext-white\b/, label: 'text-white' },
  { re: /\bbg-(gray|slate|zinc|neutral|stone|blue|green|red|emerald|amber|yellow)-\d{2,3}\b/, label: 'couleur Tailwind brute' },
  { re: /\btext-(gray|slate|zinc|neutral|stone|blue|green|red|emerald|amber|yellow)-\d{2,3}\b/, label: 'couleur Tailwind brute' },
  { re: /\bborder-(gray|slate|zinc|neutral|stone|blue|green|red|emerald|amber|yellow)-\d{2,3}\b/, label: 'couleur Tailwind brute' },
  { re: /#[0-9a-f]{3,8}\b/i, label: 'couleur hexadécimale' },
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(scanDir, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (rel === 'components/ui') continue;
      walk(full, out);
    } else if (/\.(jsx?|css|html)$/.test(entry.name)) {
      if (rel === 'styles/tokens.css') continue;
      out.push({ full, rel });
    }
  }
  return out;
}

let failed = false;
for (const { full, rel } of walk(scanDir)) {
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const { re, label } of FORBIDDEN) {
      if (re.test(line)) {
        console.error(`${rel}:${index + 1}: ${label} interdit hors tokens.css -> ${line.trim()}`);
        failed = true;
      }
    }
  });
}

if (failed) {
  console.error('\ncheck:styles ÉCHEC — utilisez les tokens de client/src/styles/tokens.css.');
  process.exit(1);
}
console.log('check:styles OK');
