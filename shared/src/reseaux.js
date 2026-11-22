/**
 * V14 — extraction de l'identité d'une page sociale depuis une URL de publication.
 * Fonction pure : aucun appel réseau, aucune inférence sur un lien non identifiable.
 * La résolution de lien court, si elle est tentée, est une étape UI optionnelle et
 * distincte (voir server/src/services/liens.js) : elle ne modifie pas ce résultat.
 */
import { z } from 'zod';
import { PLATEFORMES } from './constants.js';
import { COMPTE_SOCIAL_TYPES } from './reseauxSociaux.js';
import { normaliserUrl } from './url.js';

const RESAUX_HOSTS = {
  'facebook.com': 'facebook', 'fb.com': 'facebook', 'fb.watch': 'facebook',
  'instagram.com': 'instagram', 'instagr.am': 'instagram',
  'tiktok.com': 'tiktok', 'vm.tiktok.com': 'tiktok', 'vt.tiktok.com': 'tiktok',
  'youtube.com': 'youtube', 'youtu.be': 'youtube',
  'x.com': 'x', 'twitter.com': 'x', 't.co': 'x',
  't.me': 'telegram', 'telegram.me': 'telegram',
};

// Segments Facebook qui ne désignent jamais une page, même en première position.
const FB_RESERVES = new Set([
  'share', 'watch', 'reel', 'reels', 'groups', 'events', 'marketplace', 'photo', 'photos',
  'photo.php', 'permalink.php', 'story.php', 'hashtag', 'login', 'sharer', 'plugins',
  'help', 'policies', 'stories', 'video', 'videos',
]);
const IG_RESERVES = new Set(['p', 'reel', 'reels', 'stories', 'tv', 'accounts', 'explore', 'direct', 'about']);
const X_RESERVES = new Set(['i', 'intent', 'home', 'search', 'share', 'explore']);
const TG_RESERVES = new Set(['c', 's', 'share', 'joinchat']);

const vide = (reseau, contenu_type) => ({
  reseau, contenu_type, statut: 'indetermine', identifiants: [], page_url: null,
});
const identifie = (reseau, contenu_type, type, valeur, page_url) => ({
  reseau,
  contenu_type,
  statut: 'identifie',
  identifiants: [{ type, valeur: String(valeur) }],
  page_url,
});
const pageFb = (valeur) => (/^\d+$/.test(valeur)
  ? `https://facebook.com/profile.php?id=${valeur}`
  : `https://facebook.com/${valeur}`);

// V14 — contrats d'entrée des API de sélection de page (validées côté client et serveur).
export const sourceIdentifiantSchema = z.object({
  type: z.enum(['slug', 'id', 'handle', 'canal']),
  valeur: z.string().trim().min(1).max(300),
}).strict();
const identifiantSchema = sourceIdentifiantSchema;
export const identifierRequestSchema = z.object({ url: z.string().trim().min(1).max(2048) }).strict();
export const rechercheSourcesQuerySchema = z.object({
  q: z.string().trim().max(150).default(''),
  reseau: z.enum(PLATEFORMES).optional(),
  commune_id: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(30).default(12),
  recents: z.string().trim().max(200).default(''),
}).strict();
export const sourceRapideSchema = z.object({
  reseau: z.enum(PLATEFORMES),
  identifiants: z.array(identifiantSchema).min(1).max(4).optional(),
  page_url: z.string().trim().min(1).max(2048).optional(),
  nom: z.string().trim().max(200).default(''),
  nature: z.enum(COMPTE_SOCIAL_TYPES).default('page'),
  commune_id: z.number().int().positive().nullable().optional(),
  daira_id: z.number().int().positive().nullable().optional(),
  observations: z.string().trim().max(2000).default(''),
  alias_de: z.number().int().positive().optional(),
}).strict()
  .refine((data) => Boolean(data.alias_de || data.page_url || data.identifiants?.length),
    { message: 'URL de page ou identifiant requis', path: ['page_url'] })
  .refine((data) => Boolean(data.alias_de || data.nom.trim()),
    { message: 'Le nom de la page est requis', path: ['nom'] });

function nettoyerHote(hote) {
  return String(hote || '').toLowerCase().replace(/\.$/, '').replace(/^(www|m|web|mbasic)\./, '');
}

/** Valeur de comparaison : casse ignorée, points et tirets conservés. */
export function normaliserIdentifiant(type, valeur) {
  const brut = String(valeur ?? '').trim();
  return (type === 'handle' || type === 'canal' ? brut.replace(/^@/, '') : brut).toLowerCase();
}

/** Nature suggérée pour le panneau d'ajout ; à confirmer par l'utilisateur. */
export function natureSuggeree(identite) {
  if (identite?.statut !== 'identifie') return 'autre';
  const [identifiant] = identite.identifiants;
  if (!identifiant) return 'autre';
  if (identite.reseau === 'facebook') {
    if (identite.page_url?.includes('/groups/')) return 'groupe';
    // Les pages Facebook récentes utilisent aussi profile.php?id=…, mais avec un
    // identifiant long (≥ 12 chiffres) : les forcer en « profil » empêchait les
    // opérateurs d'enregistrer une page et rangeait à tort les programmes locaux.
    if (identifiant.type === 'id' && /^\d{12,}$/.test(identifiant.valeur)) return 'page';
    if (identite.page_url?.includes('profile.php')) return 'profil';
    return 'page';
  }
  if (identite.reseau === 'instagram') return identifiant.type === 'handle' ? 'profil' : 'page';
  if (identite.reseau === 'tiktok' || identite.reseau === 'x') return 'profil';
  if (identite.reseau === 'youtube' || identite.reseau === 'telegram') return 'chaine';
  return 'autre';
}

/** Proposition de nom à partir d'un slug : « aintaya.news » → « Aintaya News ». */
export function nomSuggere(identite) {
  if (identite?.statut !== 'identifie') return '';
  const [identifiant] = identite.identifiants;
  if (!identifiant || identifiant.type === 'id') return '';
  return identifiant.valeur
    .replace(/^@/, '')
    .split(/[._-]+/)
    .filter(Boolean)
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1))
    .join(' ')
    .slice(0, 200);
}

function facebook(url, parts, contenu_type) {
  const id = url.searchParams.get('id');
  if (parts[0] === 'profile.php' && /^\d+$/.test(id || '')) {
    return identifie('facebook', contenu_type, 'id', id, pageFb(id));
  }
  if ((parts[0] === 'permalink.php' || parts[0] === 'story.php') && /^\d+$/.test(id || '')) {
    return identifie('facebook', contenu_type, 'id', id, pageFb(id));
  }
  if (parts[0] === 'pages' && parts[1] && /^\d+$/.test(parts[2] || '')) {
    return identifie('facebook', contenu_type, 'id', parts[2], pageFb(parts[2]));
  }
  if (parts[0] === 'people' && /^\d+$/.test(parts[2] || '')) {
    return identifie('facebook', contenu_type, 'id', parts[2], pageFb(parts[2]));
  }
  if (parts[0] === 'groups' && parts[1]) {
    if (parts[2] === 'user' && parts[3]) {
      return identifie('facebook', contenu_type, 'id', parts[3], pageFb(parts[3]));
    }
    const valeur = decodeURIComponent(parts[1]);
    return identifie('facebook', contenu_type, /^\d+$/.test(valeur) ? 'id' : 'slug', valeur,
      `https://facebook.com/groups/${valeur}`);
  }
  const premier = parts[0] ? decodeURIComponent(parts[0]) : '';
  if (!premier || FB_RESERVES.has(premier.toLowerCase()) || premier.includes('.php')) {
    return vide('facebook', contenu_type);
  }
  return identifie('facebook', contenu_type, /^\d+$/.test(premier) ? 'id' : 'slug', premier, pageFb(premier));
}

function instagram(parts, contenu_type) {
  const [a, b] = parts.map((part) => decodeURIComponent(part));
  if (a === 'stories' && b) return identifie('instagram', contenu_type, 'handle', b, `https://instagram.com/${b}`);
  if (!a || IG_RESERVES.has(a.toLowerCase())) return vide('instagram', contenu_type);
  if (['p', 'reel', 'reels', 'tv'].includes(a.toLowerCase()) && !b) return vide('instagram', contenu_type);
  return identifie('instagram', contenu_type, 'handle', a, `https://instagram.com/${a}`);
}

function tiktok(parts, contenu_type, hote) {
  if (hote.startsWith('vm.') || hote.startsWith('vt.')) return vide('tiktok', contenu_type);
  const premier = parts[0] ? decodeURIComponent(parts[0]) : '';
  if (!premier.startsWith('@') || premier.length < 2) return vide('tiktok', contenu_type);
  const handle = premier.slice(1);
  return identifie('tiktok', contenu_type, 'handle', handle, `https://tiktok.com/@${handle}`);
}

function youtube(parts, contenu_type, hote) {
  const premier = parts[0] ? decodeURIComponent(parts[0]) : '';
  if (hote === 'youtu.be') return vide('youtube', contenu_type);
  if (premier.startsWith('@') && premier.length > 1) {
    return identifie('youtube', contenu_type, 'canal', premier, `https://youtube.com/${premier}`);
  }
  if (['channel', 'c', 'user'].includes(premier) && parts[1]) {
    const valeur = decodeURIComponent(parts[1]);
    return identifie('youtube', contenu_type, 'canal', valeur, `https://youtube.com/${premier}/${valeur}`);
  }
  return vide('youtube', contenu_type);
}

function x(parts, contenu_type, hote) {
  const premier = parts[0] ? decodeURIComponent(parts[0]) : '';
  if (hote === 't.co' || !premier || X_RESERVES.has(premier.toLowerCase())) return vide('x', contenu_type);
  return identifie('x', contenu_type, 'handle', premier, `https://x.com/${premier}`);
}

function telegram(parts, contenu_type) {
  const premier = parts[0] ? decodeURIComponent(parts[0]) : '';
  if (!premier || TG_RESERVES.has(premier.toLowerCase())) return vide('telegram', contenu_type);
  return identifie('telegram', contenu_type, 'canal', premier, `https://t.me/${premier}`);
}

function typeContenu(reseau, parts, url, hote) {
  const p = parts.map((part) => part.toLowerCase());
  if (reseau === 'facebook') {
    if (hote === 'fb.watch' || p[0] === 'watch') return 'video';
    if (p[0] === 'reel' || p[1] === 'reels' || p[0] === 'reels') return 'reel';
    if (p[0] === 'share') return p[1] === 'v' ? 'video' : p[1] === 'r' ? 'reel' : 'post';
    if (p[0] === 'permalink.php') return 'post';
    if (p.includes('videos')) return 'video';
    if (p.includes('photos') || p[0] === 'photo.php') return 'photo';
    if (p[0] === 'story.php' || p[0] === 'stories') return 'story';
    if (p.includes('posts')) return 'post';
  }
  if (reseau === 'instagram') {
    if (p[0] === 'stories') return 'story';
    if (p.includes('reel') || p.includes('reels')) return 'reel';
    if (p[0] === 'p' || p[1] === 'p') return 'post';
    if (p[0] === 'tv') return 'video';
  }
  if (reseau === 'tiktok') return p.includes('video') ? 'video' : p.includes('photo') ? 'photo' : 'autre';
  if (reseau === 'youtube') {
    if (hote === 'youtu.be' || p[0] === 'watch' || p[0] === 'live') return p[0] === 'live' ? 'direct' : 'video';
    if (p[0] === 'shorts') return 'short';
  }
  if (reseau === 'x' && p[1] === 'status') return 'post';
  if (reseau === 'telegram' && parts.length > 1 && !TG_RESERVES.has(p[0])) return 'post';
  if (url.searchParams.has('v')) return 'video';
  return 'autre';
}

/**
 * @returns {{reseau:string, contenu_type:string, statut:'identifie'|'indetermine',
 *   identifiants:Array<{type:'slug'|'id'|'handle'|'canal',valeur:string}>, page_url:string|null}}
 */
export function extraireIdentiteSource(raw) {
  // normaliserUrl() retire les identifiants et le port : ils sont contrôlés sur l'URL brute.
  try {
    const brut = new URL(String(raw || ''));
    if (brut.username || brut.password || (brut.port && !['80', '443'].includes(brut.port))) {
      return vide('autre', 'autre');
    }
  } catch { /* normaliserUrl() applique la validation définitive */ }
  const normalisee = normaliserUrl(raw);
  if (!normalisee.ok) return vide('autre', 'autre');
  let url;
  try { url = new URL(normalisee.url); } catch { return vide('autre', 'autre'); }
  const hote = nettoyerHote(url.hostname);
  url.hostname = hote;
  const reseau = RESAUX_HOSTS[hote] || 'autre';
  let parts = url.pathname.split('/').filter(Boolean);
  try { parts = parts.map((part) => decodeURIComponent(part)); } catch { return vide(reseau, 'autre'); }
  const contenu_type = typeContenu(reseau, parts, url, hote);
  if (hote === 'fb.watch') return vide('facebook', contenu_type);
  if (reseau === 'facebook') return facebook(url, parts, contenu_type);
  if (reseau === 'instagram') return instagram(parts, contenu_type);
  if (reseau === 'tiktok') return tiktok(parts, contenu_type, hote);
  if (reseau === 'youtube') return youtube(parts, contenu_type, hote);
  if (reseau === 'x') return x(parts, contenu_type, hote);
  if (reseau === 'telegram') return telegram(parts, contenu_type);
  return vide('autre', contenu_type);
}
