import { api } from '../api/client.js';

const WINDOW_MS = 60_000;
const recent = new Map();

function canReport() {
  const now = Date.now();
  const entry = recent.get('key');
  if (entry && entry.expiresAt > now) return false;
  recent.set('key', { at: now, expiresAt: now + WINDOW_MS });
  return true;
}

export async function reportClientError(error, context = {}) {
  const message = String(error?.message || error || 'Erreur inconnue');
  const stack = String(error?.stack || '');
  if (!canReport()) return null;
  try {
    const payload = {
      message: message.slice(0, 2000),
      stack: stack.slice(0, 4000),
      route: String(context.route || window.location.hash || ''),
      userAgent: String(navigator.userAgent || '').slice(0, 500),
      version: String(context.version || '5.0.0'),
    };
    const result = await api('/client-errors', { method: 'POST', body: payload });
    return result;
  } catch {
    // Le journal d'erreurs client ne doit jamais casser l'application.
    return null;
  }
}

export function installClientErrorHandlers() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (event) => { void reportClientError(event.error || event.message, { route: window.location.hash }); });
  window.addEventListener('unhandledrejection', (event) => { void reportClientError(event.reason, { route: window.location.hash }); });
}
