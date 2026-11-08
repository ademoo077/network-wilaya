import { DATE_RE } from './constants.js';

export const TZ_ALGER = 'Africa/Algiers';

/** Date du jour (calendrier Alger) au format YYYY-MM-DD. */
export function todayAlgiers(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_ALGER, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function isDateString(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = parseDateUtc(value);
  return d !== null && toDateString(d) === value;
}

/** Date UTC minuit construite depuis YYYY-MM-DD (jamais de parsing local). */
export function parseDateUtc(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

export function toDateString(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function addDays(value, days) {
  const d = parseDateUtc(value);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d);
}

export function diffDays(from, to) {
  const a = parseDateUtc(from);
  const b = parseDateUtc(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function dayOfWeek(value) {
  const d = parseDateUtc(value);
  return d ? d.getUTCDay() : null;
}

export function weekStart(value, weekStartDay = 0) {
  const d = parseDateUtc(value);
  if (!d) return null;
  const wsd = ((Number(weekStartDay) % 7) + 7) % 7;
  const back = (d.getUTCDay() - wsd + 7) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return toDateString(d);
}

export function weekEnd(value, weekStartDay = 0) {
  const start = weekStart(value, weekStartDay);
  return start ? addDays(start, 6) : null;
}

export function monthStart(value) {
  const d = parseDateUtc(value);
  if (!d) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function eachDay(from, to) {
  const out = [];
  let cur = from;
  let guard = 0;
  while (cur && cur <= to && guard < 3700) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard += 1;
  }
  return out;
}

export function eachWeek(from, to, weekStartDay = 0) {
  const out = [];
  let cur = weekStart(from, weekStartDay);
  let guard = 0;
  while (cur && cur <= to && guard < 600) {
    out.push({ debut: cur, fin: addDays(cur, 6) });
    cur = addDays(cur, 7);
    guard += 1;
  }
  return out;
}

/** Affichage JJ/MM/AAAA (chiffres occidentaux). */
export function formatDate(value) {
  if (!value) return '—';
  const s = String(value).slice(0, 10);
  if (!isDateString(s)) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

/** Affichage JJ/MM/AAAA HH:mm (heure d'Alger). */
export function formatDateTime(value, timeZone = TZ_ALGER) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    const parts = new Intl.DateTimeFormat('fr-FR', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(date).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
    return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
  } catch {
    return '—';
  }
}

export function isFuture(value, today = todayAlgiers()) {
  return Boolean(value) && value > today;
}

export function clampPeriod(from, to, maxDays = null) {
  if (!from && !to) return { from: null, to: null };
  const f = from || '1970-01-01';
  const t = to || todayAlgiers();
  if (f > t) return { from: t, to: f };
  if (maxDays) {
    const diff = diffDays(f, t);
    if (diff !== null && diff > maxDays) return { from: addDays(t, -maxDays), to: t };
  }
  return { from: f, to: t };
}

/** Période précédente de même durée (bornes incluses). */
export function previousPeriod(from, to) {
  if (!from || !to) return { from: null, to: null };
  const days = diffDays(from, to);
  if (days === null || days < 0) return { from: null, to: null };
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -days);
  return { from: prevFrom, to: prevTo };
}
