import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { config } from '../config/index.js';

const PREFIX = 'v1';

export class SecretsError extends Error {
  constructor(message, code = 'SECRETS_INDISPONIBLE') {
    super(message);
    this.name = 'SecretsError';
    this.code = code;
  }
}

function keyBytes(key) {
  if (!key) throw new SecretsError('SECRETS_KEY absent : configurez une clé de 64 caractères hexadécimaux dans .env', 'SECRETS_KEY_ABSENTE');
  const text = String(key).trim();
  let raw;
  if (/^[0-9a-f]{64}$/i.test(text)) raw = Buffer.from(text, 'hex');
  else {
    try { raw = Buffer.from(text, 'base64'); } catch { raw = Buffer.alloc(0); }
  }
  if (raw.length < 32) raw = createHash('sha256').update(text).digest();
  return raw.subarray(0, 32);
}

export function encryptSecret(value, key = config.secretsKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(key), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(payload, key = config.secretsKey) {
  if (typeof payload !== 'string' || !payload.startsWith(`${PREFIX}:`)) {
    throw new SecretsError('Secret chiffré invalide', 'SECRET_INVALIDE');
  }
  const [, ivText, tagText, dataText] = payload.split(':');
  if (!ivText || !tagText || !dataText) throw new SecretsError('Secret chiffré incomplet', 'SECRET_INVALIDE');
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyBytes(key), Buffer.from(ivText, 'base64'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new SecretsError('Impossible de déchiffrer le secret (clé erronée ou données altérées)', 'SECRET_INDECHIFFRABLE');
  }
}

export function encryptJson(value, key = config.secretsKey) {
  return encryptSecret(JSON.stringify(value), key);
}

export function decryptJson(payload, key = config.secretsKey) {
  const text = decryptSecret(payload, key);
  try { return JSON.parse(text); } catch { throw new SecretsError('Configuration déchiffrée illisible', 'SECRET_INVALIDE'); }
}

export function maskSecret(value) {
  const text = String(value || '');
  if (!text) return '';
  return text.length <= 8 ? '••••••••' : `${text.slice(0, 4)}••••${text.slice(-2)}`;
}

export function generateToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function pseudonymize(value, key = config.secretsKey) {
  if (!value) return null;
  return createHmac('sha256', keyBytes(key)).update(String(value)).digest('hex').slice(0, 20);
}

export function secretsKeyConfigured() {
  return Boolean(config.secretsKey);
}
