import { api } from '../api/client.js';
import { sanitizeClientError, VERSION } from '@anm/shared';

const WINDOW_MS = 60_000;
const recent = [];

function canReport() {
  const now = Date.now();
  while (recent.length && recent[0] < now - WINDOW_MS) recent.shift();
  if (recent.length >= 20) return false;
  recent.push(now);
  return true;
}

export async function reportClientError(error, context = {}) {
  const message = String(error?.message || error || 'Erreur inconnue');
  const stack = String(error?.stack || '');
  if (!canReport()) return null;
  try {
    const payload = sanitizeClientError({
      message: message.slice(0, 2000),
      stack: stack.slice(0, 4000),
      route: String(context.route || window.location.hash || ''),
      userAgent: String(navigator.userAgent || '').slice(0, 500),
      version: String(context.version || VERSION),
    });
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
