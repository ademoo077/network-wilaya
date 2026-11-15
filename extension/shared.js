/* Utilitaires partagés entre le popup et la page de réglages.
   Aucun accès réseau n'est effectué ici. */
(function () {
  const STORAGE_KEY = 'veilleCapture';

  function normalizePlatform(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    let parsed;
    try { parsed = new URL(raw); } catch { return null; }
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
  }

  function elementUrl(platformUrl, id) {
    const base = normalizePlatform(platformUrl);
    if (!base || !/^[1-9]\d*$/.test(String(id))) return null;
    return `${base}/#/veille/elements/${id}`;
  }

  async function readConfig() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const value = stored[STORAGE_KEY] || {};
    return { platformUrl: normalizePlatform(value.platformUrl) || '', token: String(value.token || '') };
  }

  async function writeConfig(config) {
    const payload = {
      platformUrl: normalizePlatform(config.platformUrl) || '',
      token: String(config.token || '').trim(),
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: payload });
    return payload;
  }

  function isConfigured(config) {
    return Boolean(config && config.platformUrl && config.token);
  }

  window.VeilleCapture = { STORAGE_KEY, normalizePlatform, elementUrl, readConfig, writeConfig, isConfigured };
})();
