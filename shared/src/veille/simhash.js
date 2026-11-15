import { normalizeForMatch } from './normalize.js';

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK64 = 0xffffffffffffffffn;

function hash64(value) {
  let hash = FNV_OFFSET;
  for (const char of String(value)) {
    hash ^= BigInt(char.codePointAt(0));
    hash = (hash * FNV_PRIME) & MASK64;
  }
  return hash;
}

export function simhash64(text) {
  const counts = new Map();
  for (const token of normalizeForMatch(text).split(' ').filter(Boolean)) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  const vector = new Array(64).fill(0);
  for (const [token, weight] of counts) {
    const hash = hash64(token);
    for (let bit = 0; bit < 64; bit += 1) {
      const isSet = ((hash >> BigInt(bit)) & 1n) === 1n;
      vector[bit] += isSet ? weight : -weight;
    }
  }
  let result = 0n;
  for (let bit = 0; bit < 64; bit += 1) if (vector[bit] >= 0) result |= 1n << BigInt(bit);
  return result.toString(16).padStart(16, '0');
}

export function hammingDistance(a, b) {
  if (!a || !b) return 64;
  let value = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (value) { count += Number(value & 1n); value >>= 1n; }
  return count;
}

export function isNearDuplicate(a, b, maxDistance = 3) {
  return Boolean(a && b && hammingDistance(a, b) <= maxDistance);
}
