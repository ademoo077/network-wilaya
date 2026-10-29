import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'client/src');
const EXCLUDE = new Set(['styles/tokens.css', 'components/Layout.jsx', 'pages/Login.jsx']);
const FORBIDDEN = [
  /\bbg-white\b/, /\bbg-gray\b/, /\btext-gray\b/, /\bbg-slate\b/,
  /\bbg-blue\b/, /\bbg-green\b/, /\bbg-red\b/, /\btext-blue\b/, /\bborder-gray\b/,
  /\bbg-red-50\b/, /\bbg-blue-600\b/, /\bbg-green-600\b/,
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (rel === 'components/ui') continue;
      walk(full, out);
    } else if (/\.(jsx?|css)$/.test(entry.name)) {
      if (EXCLUDE.has(rel)) continue;
      out.push({ full, rel });
    }
  }
  return out;
}

let failed = false;
for (const { full, rel } of walk(ROOT)) {
  const content = fs.readFileSync(full, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const re of FORBIDDEN) {
      if (re.test(line)) {
        console.error(`${rel}:${i + 1}: forbidden style token -> ${line.trim()}`);
        failed = true;
      }
    }
  });
}

if (failed) {
  console.error('\ncheck:styles FAILED - migrate to design tokens.');
  process.exit(1);
}
console.log('check:styles OK');