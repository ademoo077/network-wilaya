/* Analyse RSS / Atom minimale, sans dépendance externe.
   Le contenu tiers est traité comme une donnée : jamais évalué ni injecté en HTML. */
import { ConnectorError } from '../http.js';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(value) {
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    const lower = String(code).toLowerCase();
    if (lower.startsWith('#x')) {
      const point = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    }
    if (lower.startsWith('#')) {
      const point = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    }
    return Object.hasOwn(ENTITIES, lower) ? ENTITIES[lower] : match;
  });
}

function unwrapCdata(value) {
  return String(value || '').replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
}

function cleanText(value) {
  return decodeEntities(unwrapCdata(value)).replace(/\s+/g, ' ').trim();
}

function plainText(value) {
  const text = unwrapCdata(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ');
  return cleanText(text);
}

function tag(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
    if (match) return match[1];
  }
  return '';
}

function linkOf(block) {
  const href = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i);
  if (href) return decodeEntities(href[1]).trim();
  const inner = tag(block, ['link']);
  return inner ? decodeEntities(inner).replace(/<[^>]*>/g, '').trim() : '';
}

function dateOf(value) {
  const raw = cleanText(value);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return raw.slice(0, 40);
}

function feedTitle(xml, isAtom) {
  if (isAtom) {
    const head = xml.split(/<entry\b/i)[0];
    return plainText(tag(head, ['title'])).slice(0, 300) || null;
  }
  const channel = xml.match(/<channel\b[\s\S]*?<\/channel>/i);
  if (!channel) return null;
  const head = channel[0].split(/<item\b/i)[0];
  return plainText(tag(head, ['title'])).slice(0, 300) || null;
}

export function parseFeed(xml) {
  const text = String(xml || '');
  if (!text.trim()) throw new ConnectorError('XML_INVALIDE', 'Flux vide ou illisible');
  const isAtom = /<feed\b/i.test(text);
  const isRss = /<rss\b/i.test(text) || /<rdf:RDF\b/i.test(text);
  if (!isAtom && !isRss) throw new ConnectorError('XML_INVALIDE', 'Flux RSS/Atom non reconnu');
  const pattern = isAtom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi;
  const items = [];
  for (const match of text.matchAll(pattern)) {
    const block = match[0];
    const title = plainText(tag(block, ['title'])).slice(0, 500);
    const link = linkOf(block).slice(0, 2000);
    const guid = cleanText(tag(block, ['guid', 'id'])).slice(0, 500);
    const summary = plainText(tag(block, ['description', 'summary', 'content:encoded', 'content'])).slice(0, 4000);
    const published = dateOf(tag(block, ['pubDate', 'published', 'updated', 'dc:date']));
    if (!title && !summary) continue;
    items.push({ id: guid || link || null, title, link, summary, published });
  }
  return { title: feedTitle(text, isAtom), items, atom: isAtom };
}
