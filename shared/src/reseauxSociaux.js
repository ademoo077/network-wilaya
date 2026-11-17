import { z } from 'zod';
import { PLATEFORMES, MAX_IMPORT_ROWS } from './constants.js';
import { normaliserUrl } from './url.js';
import { territoryKey } from './territory.js';

export const COMPTE_SOCIAL_TYPES = ['page', 'profil', 'groupe', 'chaine', 'autre'];
export const COMPTE_SOCIAL_VERIFICATIONS = ['a_verifier', 'verifie'];
export const COMPTE_SOCIAL_LABELS = {
  page: { fr: 'Page locale', ar: 'صفحة محلية' },
  profil: { fr: 'Profil citoyen', ar: 'حساب مواطن' },
  groupe: { fr: 'Groupe', ar: 'مجموعة' },
  chaine: { fr: 'Chaîne', ar: 'قناة' },
  autre: { fr: 'Autre compte', ar: 'حساب آخر' },
};

const EXTRA_TRACKING = /^(?:__cft__.*|__tn__|rdid|_t|_r|hoisted_section_header_type|multi_permalinks)$/i;
const FACEBOOK_RESERVED = new Set(['reel', 'reels', 'watch', 'share', 'photo', 'photos', 'video', 'videos', 'story.php', 'permalink.php', 'login', 'help', 'events']);

/** Identité d'un compte, sans accès réseau. Le lien fourni reste conservé séparément. */
export function normaliserCompteSocial(raw) {
  const normalized = normaliserUrl(raw);
  if (!normalized.ok) return normalized;
  const original = new URL(raw.trim());
  if (original.username || original.password) return { ok: false, error: 'IDENTIFIANTS_INTERDITS' };
  if (original.port && !['80', '443'].includes(original.port)) return { ok: false, error: 'PORT_INTERDIT' };
  const url = new URL(normalized.url);
  for (const key of [...url.searchParams.keys()]) if (EXTRA_TRACKING.test(key)) url.searchParams.delete(key);
  const plateforme = normalized.plateforme;
  if (plateforme !== 'autre') url.protocol = 'https:';
  const parts = url.pathname.split('/').filter(Boolean);
  let compte = null;
  let nature = null;
  let publication = false;
  const root = (pathname, search = '') => `${url.protocol}//${url.hostname}${pathname}${search}`;

  if (plateforme === 'facebook') {
    if (['fb.com', 'web.facebook.com', 'mbasic.facebook.com'].includes(url.hostname)) url.hostname = 'facebook.com';
    if (parts[0] === 'profile.php' && /^\d+$/.test(url.searchParams.get('id') || '')) {
      compte = root('/profile.php', `?id=${url.searchParams.get('id')}`);
    } else if (parts[0] === 'groups' && parts[1]) {
      if (parts[2] === 'user' && /^\d+$/.test(parts[3] || '')) {
        compte = root('/profile.php', `?id=${parts[3]}`); nature = 'profil';
      } else {
        compte = root(`/groups/${parts[1]}`); nature = 'groupe'; publication = parts.includes('posts');
      }
    } else if (parts[0] === 'story.php' && /^\d+$/.test(url.searchParams.get('id') || '')) {
      compte = root('/profile.php', `?id=${url.searchParams.get('id')}`); publication = true;
    } else if (parts[0] && !FACEBOOK_RESERVED.has(parts[0].toLowerCase()) && !parts[0].includes('.php') && url.hostname === 'facebook.com') {
      compte = /^\d+$/.test(parts[0]) ? root('/profile.php', `?id=${parts[0]}`) : root(`/${parts[0].toLowerCase()}`);
      publication = parts.some((part) => ['posts', 'videos', 'photos'].includes(part));
    } else publication = Boolean(parts[0]);
  } else if (plateforme === 'tiktok' && url.hostname === 'tiktok.com' && /^@[\w.]+$/.test(parts[0] || '')) {
    compte = root(`/${parts[0].toLowerCase()}`); publication = parts[1] === 'video';
  } else if (plateforme === 'instagram') {
    publication = ['p', 'reel', 'reels', 'stories', 'tv'].includes(parts[0]);
    if (url.hostname === 'instagram.com' && parts[0] && !publication && !['accounts', 'explore', 'direct', 'about'].includes(parts[0])) compte = root(`/${parts[0].toLowerCase()}`);
  } else if (plateforme === 'youtube') {
    if (url.hostname === 'youtube.com' && parts[0]?.startsWith('@')) compte = root(`/${parts[0].toLowerCase()}`);
    else if (url.hostname === 'youtube.com' && ['channel', 'c', 'user'].includes(parts[0]) && parts[1]) compte = root(`/${parts[0]}/${parts[1]}`);
    if (compte) nature = 'chaine';
    publication = !compte && Boolean(parts[0]);
  } else if (plateforme === 'x' && ['x.com', 'twitter.com'].includes(url.hostname) && /^[\w]{1,15}$/.test(parts[0] || '') && !['i', 'intent', 'home', 'search'].includes(parts[0])) {
    url.hostname = 'x.com'; compte = root(`/${parts[0].toLowerCase()}`); publication = parts[1] === 'status';
  } else if (plateforme === 'telegram' && parts[0] && !['c', 's', 'share'].includes(parts[0])) {
    url.hostname = 't.me'; compte = root(`/${parts[0]}`); nature = 'chaine'; publication = parts.length > 1;
  } else if (plateforme === 'autre' || plateforme === 'whatsapp') {
    compte = url.toString().replace(/\/$/, '');
  }
  if (!compte && parts.length) publication = true;
  if (!parts.length && plateforme !== 'autre') return { ok: false, error: 'LIEN_COMPTE_REQUIS' };
  return { ok: true, url: compte || url.toString().replace(/\/$/, ''), plateforme, compte_url: compte, nature, publication };
}

/** Variantes orthographiques du tableau LIEN, sans création ni déplacement de territoire. */
export function socialTerritoryKey(value) {
  const key = territoryKey(value);
  return ({ guedeconstantine: 'djasrkasentina', staouali: 'staoueli', babzouar: 'babezzouar',
    babahacene: 'babahassen', khraicia: 'khraissia', mohamadia: 'mohammadia',
    bologhin: 'bologhine', elharrache: 'elharrach', lesecalyptus: 'leseucalyptus',
    ouedkoraich: 'ouedkoriche', bachdjerrah: 'bachdjerrah', bachdjerah: 'bachdjerrah', delybrahim: 'delyibrahim' })[key] || key;
}

const optionalId = z.number().int().positive().nullable().optional();
const compteFields = {
  nom: z.string().trim().min(1, 'Nom requis').max(200),
  lien_url: z.string().trim().min(1, 'Lien requis').max(2048),
  plateforme: z.enum(PLATEFORMES), categorie: z.enum(COMPTE_SOCIAL_TYPES),
  daira_id: optionalId, commune_id: optionalId,
  ca_libelle: z.string().trim().max(200).default(''),
  commune_libelle: z.string().trim().max(200).default(''),
  observations: z.string().trim().max(3000).default(''),
  verification: z.enum(COMPTE_SOCIAL_VERIFICATIONS).default('a_verifier'),
  actif: z.number().int().min(0).max(1).default(1),
};
function validateCompte(data, ctx) {
  if (data.lien_url !== undefined) {
    const result = normaliserCompteSocial(data.lien_url);
    if (!result.ok) ctx.addIssue({ code: 'custom', path: ['lien_url'], message: 'Lien de compte HTTP(S) valide requis, sans identifiants' });
    else if (data.plateforme && result.plateforme !== data.plateforme) {
      ctx.addIssue({ code: 'custom', path: ['plateforme'], message: 'Le réseau doit correspondre au lien fourni' });
    }
  }
  if (data.commune_id && data.daira_id === null) ctx.addIssue({ code: 'custom', path: ['daira_id'], message: 'CA requis pour cette commune' });
}
export const compteSocialCreateSchema = z.object(compteFields).strict().superRefine(validateCompte);
export const compteSocialUpdateSchema = z.object(compteFields).partial().extend({ version: z.number().int().positive() }).strict()
  .refine((data) => Object.keys(data).some((key) => key !== 'version'), { message: 'Modification requise' }).superRefine(validateCompte);

export const reseauxSociauxQuerySchema = z.object({
  q: z.string().trim().max(150).default(''),
  plateforme: z.enum(PLATEFORMES).optional(), categorie: z.enum(COMPTE_SOCIAL_TYPES).optional(),
  verification: z.enum(COMPTE_SOCIAL_VERIFICATIONS).optional(), actif: z.enum(['0', '1']).optional(),
  daira_id: z.coerce.number().int().positive().optional(), commune_id: z.coerce.number().int().positive().optional(),
  non_rattache: z.enum(['ca', 'commune']).optional(),
  ca_libelle: z.string().trim().max(200).optional(), commune_libelle: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().max(100000).default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(25),
  sort: z.enum(['nom', 'plateforme', 'categorie', 'ca', 'commune', 'updated_at']).default('nom'),
  dir: z.enum(['asc', 'desc']).default('asc'),
  format: z.enum(['csv', 'xlsx']).optional(),
}).strict();

export const reseauxSociauxSourceSchema = z.object({
  fichier: z.string().min(1).max(200), feuille: z.literal('LIEN'),
  lignes: z.array(z.object({
    ligne: z.number().int().positive(), ca: z.string().max(200), commune: z.string().max(200),
    lien: z.string().max(2048), nom: z.string().max(2048),
    autres: z.string().max(2048), nom_autres: z.string().max(2048),
  }).strict()).min(1).max(MAX_IMPORT_ROWS),
}).strict();
export const reseauxSociauxImportCommitSchema = z.object({ importId: z.string().uuid() }).strict();
export const reseauxSociauxImportCancelRequestSchema = reseauxSociauxImportCommitSchema;
