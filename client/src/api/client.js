let csrfToken = null;

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.error?.message || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.error?.code || 'API_ERROR';
    this.fields = payload?.error?.fields || null;
    this.details = payload?.error?.details || null;
  }
}

export function setCsrf(value) {
  csrfToken = value || null;
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const bodyIsForm = options.body instanceof FormData;
  if (options.body && !bodyIsForm && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const method = String(options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  let response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...options,
      method,
      headers,
      body: options.body && !bodyIsForm && typeof options.body !== 'string'
        ? JSON.stringify(options.body) : options.body,
    });
  } catch {
    throw new ApiError(0, { error: { code: 'NETWORK', message: 'Serveur inaccessible' } });
  }
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent('anm:unauthorized'));
    throw new ApiError(response.status, payload);
  }
  return payload;
}

export function queryString(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values || {})) {
    if (value !== undefined && value !== null && value !== '' && value !== false) params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export async function download(path, filename) {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin' });
  if (!response.ok) {
    let payload = null;
    try { payload = await response.json(); } catch { /* réponse non JSON */ }
    throw new ApiError(response.status, payload);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
