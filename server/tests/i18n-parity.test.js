import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function extractKeys(block) {
  const keys = new Set();
  const re = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/gm;
  let m;
  while ((m = re.exec(block)) !== null) keys.add(m[1]);
  return keys;
}

describe('i18n parity', () => {
  it('FR et AR ont les memes cles', () => {
    const file = fs.readFileSync(path.resolve(process.cwd(), 'client/src/i18n/index.jsx'), 'utf8');
    const frMatch = file.match(/fr:\s*\{([\s\S]*?)\n\s*\},/);
    const arMatch = file.match(/ar:\s*\{([\s\S]*?)\n\s*\},/);
    expect(frMatch).not.toBeNull();
    expect(arMatch).not.toBeNull();
    const frKeys = extractKeys(frMatch[1]);
    const arKeys = extractKeys(arMatch[1]);
    const missingInAr = [...frKeys].filter((k) => !arKeys.has(k));
    const missingInFr = [...arKeys].filter((k) => !frKeys.has(k));
    expect({ missingInAr, missingInFr }).toEqual({ missingInAr: [], missingInFr: [] });
  });
});
