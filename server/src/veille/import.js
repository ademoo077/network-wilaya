import { badRequest } from '../utils/errors.js';
import { veilleContext } from './context.js';
import { createVeilleElement } from './ingest.js';
import { hashToken } from './secrets.js';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 20000;

const TEXT_KEYS = ['texte', 'text', 'message', 'contenu', 'content', 'observations', 'observation', 'body'];
const URL_KEYS = ['url', 'lien', 'link', 'permalink', 'permalinkurl', 'href'];
const PAGE_KEYS = ['page', 'pagenom', 'pagename', 'auteur', 'author', 'source'];
const DATE_KEYS = ['date', 'datepublication', 'createdtime', 'createdat', 'published', 'publishedat'];

const WA_LINE = /^\[?(\d{1,2}[/.]\d{1,2}[/.]\d{2,4})[,\s]+(\d{1,2}:\d{2})(?::\d{2})?\]?\s*(?:-\s*)?([^:]{1,120}):\s*([\s\S]*)$/;
const WA_SYSTEM = /^(messages? et appels chiffrés|vous avez|a changé|a créé|a ajouté|a quitté|a été ajouté|a modifié|modifié le|chiffrement|ce message a été supprimé|image omise|vidéo omise|audio omis|document omis|sticker omis|gif omis)/i;

function normalizeKey(key) {
  return String(key || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pick(object, keys) {
  if (!object || typeof object !== 'object') return null;
  const index = new Map(Object.entries(object).map(([key, value]) => [normalizeKey(key), value]));
  for (const key of keys) {
    const value = index.get(key);
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return null;
}

function firstUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s<>"')]+/i);
  return match ? match[0].replace(/[.,;:!?]+$/, '') : null;
}

function itemFrom(row, defaults = {}) {
  let texte = pick(row, TEXT_KEYS) || '';
  const url = pick(row, URL_KEYS) || firstUrl(texte);
  if (!texte && url) texte = url;
  if (!texte) return null;
  return {
    texte,
    url,
    page_nom: pick(row, PAGE_KEYS) || defaults.page_nom || null,
    date_publication: pick(row, DATE_KEYS) || null,
    auteur: pick(row, PAGE_KEYS) || null,
  };
}

function detectDelimiter(line) {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && counts[char] !== undefined) counts[char] += 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return ranked[0][1] > 0 ? ranked[0][0] : ',';
}

function parseCsvRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field); field = '';
    } else if (char === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.map((cells) => cells.map((cell) => cell.trim())).filter((cells) => cells.some((cell) => cell));
}

export function parseCsv(text) {
  const cleaned = String(text || '').replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { items: [], truncated: false };
  const delimiter = detectDelimiter(lines[0]);
  const rows = parseCsvRows(cleaned, delimiter);
  const header = rows[0] || [];
  const recognized = header.some((cell) => [...TEXT_KEYS, ...URL_KEYS].includes(normalizeKey(cell)));
  const firstRow = rows[0] || [];
  const urlFirst = !recognized && /^https?:\/\//i.test(firstRow[0] || '') && !/^https?:\/\//i.test(firstRow[1] || '');
  const keys = recognized ? header.map(normalizeKey) : urlFirst ? ['url', 'texte', 'date', 'page'] : ['texte', 'url', 'date', 'page'];
  const body = recognized ? rows.slice(1) : rows;
  const items = [];
  for (const cells of body.slice(0, MAX_ROWS)) {
    const row = {};
    cells.forEach((cell, index) => { row[keys[index] || `colonne${index}`] = cell; });
    const item = itemFrom(row);
    if (item) items.push(item);
  }
  return { items, truncated: body.length > MAX_ROWS };
}

export function parseJson(text) {
  let payload;
  try { payload = JSON.parse(String(text || '').replace(/^\uFEFF/, '')); } catch {
    throw badRequest('Fichier JSON illisible');
  }
  const rows = Array.isArray(payload) ? payload
    : Array.isArray(payload?.items) ? payload.items
      : Array.isArray(payload?.elements) ? payload.elements
        : Array.isArray(payload?.data) ? payload.data : [];
  if (!rows.length) throw badRequest('Aucun élément trouvé dans le fichier JSON');
  const items = [];
  for (const row of rows.slice(0, MAX_ROWS)) {
    if (!row || typeof row !== 'object') continue;
    const item = itemFrom(row, { page_nom: 'Import JSON' });
    if (item) items.push(item);
  }
  return { items, truncated: rows.length > MAX_ROWS };
}

function whatsappDate(value) {
  const match = String(value || '').match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
  if (!match) return null;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

export function parseWhatsapp(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const messages = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(WA_LINE);
    if (match) {
      const [, date, , author, body] = match;
      if (WA_SYSTEM.test(body.trim())) continue;
      messages.push({ date: whatsappDate(date), auteur: author.trim(), texte: body.trim() });
    } else if (messages.length && !WA_SYSTEM.test(trimmed)) {
      messages[messages.length - 1].texte += `\n${trimmed}`;
    }
  }
  const items = [];
  for (const message of messages.slice(0, MAX_ROWS)) {
    const texte = message.texte.trim();
    if (!texte) continue;
    items.push({
      texte,
      url: firstUrl(texte),
      page_nom: 'WhatsApp (import)',
      date_publication: message.date,
      auteur: message.auteur,
    });
  }
  return { items, truncated: messages.length > MAX_ROWS };
}

export function parseImport(text, format) {
  const value = String(text ?? '');
  if (!value.trim()) throw badRequest('Fichier vide');
  if (Buffer.byteLength(value, 'utf8') > MAX_BYTES) throw badRequest('Fichier trop volumineux (5 Mo maximum)');
  if (format === 'csv') return parseCsv(value);
  if (format === 'json') return parseJson(value);
  if (format === 'whatsapp') return parseWhatsapp(value);
  throw badRequest('Format d’import invalide (csv, json ou whatsapp)');
}

function ensureImportSource(db, nom) {
  const label = String(nom || '').trim().slice(0, 200) || 'Import de fichiers';
  const existing = db.prepare("SELECT id FROM veille_sources WHERE type = 'import' AND nom = ? ORDER BY id LIMIT 1").get(label);
  if (existing) return Number(existing.id);
  return Number(db.prepare(`INSERT INTO veille_sources(type, nom, config_chiffree, actif, frequence_min)
    VALUES ('import', ?, NULL, 0, 1440)`).run(label).lastInsertRowid);
}

export function importElements(db, { text, format, nom, now = new Date() } = {}) {
  const { items, truncated } = parseImport(text, format);
  const sourceId = ensureImportSource(db, nom);
  const context = veilleContext(db);
  let created = 0;
  let duplicates = 0;
  let ignored = 0;
  items.forEach((item, index) => {
    try {
      const idExterne = hashToken(`import|${format}|${index}|${item.url || ''}|${item.texte}`);
      const result = createVeilleElement(db, sourceId, { ...item, id_externe: idExterne }, { context, now });
      if (result.created) created += 1; else duplicates += 1;
    } catch (error) {
      if (process.env.DEBUG_IMPORT) console.error('IMPORT_ITEM_ERROR', error);
      ignored += 1;
    }
  });
  return {
    source_id: sourceId, format, total: items.length, collected: items.length,
    newCount: created, duplicates, ignored, truncated,
    analyzed: created,
  };
}
